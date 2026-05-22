# Reset Backup

A guide to the **Reset backup** action — what it does at the Matrix protocol layer, when a user actually needs it, and how to surface it in a production UI without footgunning end users.

## What it does

In Matrix E2EE, each room message is encrypted with a per-room **Megolm session**. The sender shares that session with every device in the room at send time, but devices that join *later* can only get the session from the **server-side key backup**.

The backup itself is encrypted with a **backup decryption key** (Curve25519). The public half is embedded in the backup version's `auth_data` on the server; the private half is stored, encrypted under your **recovery key**, inside **SSSS** (Secret Storage and Sharing on Server, MSC1946).

`Reset backup` does:

1. **Generate** a new backup decryption keypair.
2. **Create** a new backup *version* on the server, advertising the new public key.
3. **Write** the new private key into SSSS, encrypted under the user's recovery key (via the `getSecretStorageKey` crypto callback).
4. **Replace** any prior active backup version. Sessions that were only in the old backup become unreachable.
5. **Cache** the new private key in this device's local rust-crypto store so the SDK's on-demand backup downloader can use it.

Under the hood (`matrix-js-sdk`):

```ts
await client.getCrypto().resetKeyBackup();
await client.getCrypto().loadSessionBackupPrivateKeyFromSecretStorage();
```

## When you have to use it

You only need `Reset backup` when the backup is in a **broken state**. Specifically:

| Symptom (in console / error toast) | Likely cause | Fix |
|---|---|---|
| `DecryptionKeyDoesNotMatchError` from `loadSessionBackupPrivateKeyFromSecretStorage` | The backup version on the server uses a different public key than the private key stored in SSSS. Usually happens when someone created a new backup version without updating SSSS, or set up SSSS against an older backup. | Reset backup. |
| `HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED` shown on every old message after entering the correct recovery key | The backup decryption key never made it into the local crypto store — typically the underlying cause is the same key mismatch above. | Reset backup. |
| Sign-in fails with `Couldn't load the backup decryption key from secret storage` | Same root cause. | Reset backup. |

You should **not** use it when:

- You simply joined a new room and haven't received its session keys yet — wait or request keys from a sibling device.
- A single message shows UTD with `HISTORICAL_MESSAGE_NO_KEY_BACKUP` — the sender never uploaded keys; reset won't help.
- You lost your recovery key — reset requires a working recovery key to write the new backup key into SSSS. The cure is "reset SSSS and start over," which is a different (more destructive) action.

### What you lose

Every Megolm inbound session that existed only in the old backup is gone. Past messages stay UTD on devices that need backup, *unless* the sender device still holds the session locally and re-uploads to the new backup version after detecting it.

### What you keep

- Your account, room memberships, and devices stay untouched.
- Your recovery key still works (we re-use it to encrypt the new backup key).
- Cross-signing identity is unaffected.
- Messages your device has already decrypted stay decryptable (they're in the local crypto store).

## How to implement it in a production product

The naive approach — a top-level "Reset backup" button in a settings page — is what end users will accidentally click out of curiosity, and you'll spend the next quarter explaining why their message history vanished. Don't do that.

### Principles

1. **Hide it until needed.** 99% of users will never have a backup mismatch. Don't put a global Reset button on the main UI.
2. **Detect the failure mode first.** The error you actually catch from the SDK (e.g. `DecryptionKeyDoesNotMatchError`) is the trigger. That's the only time the user should even see the option.
3. **Lead with the symptom, not the action.** Users care about "I can't see my old messages." They don't care about "reset key backup."
4. **Two-step confirmation, and surface the cost.** Make the destructive trade-off explicit *before* they click the destructive button.
5. **Require fresh recovery-key entry.** Don't reuse a cached recovery key for a destructive action — make the user re-type it. This both proves intent and avoids the "i pressed it from muscle memory" failure mode.

### UI surfaces (in priority order)

1. **Contextual banner**, shown only when the SDK reports the broken state on this device:

   ```
   ┌────────────────────────────────────────────────────────────────┐
   │ ⚠ We can't decrypt messages from your other devices.           │
   │                                                                 │
   │ Your key backup is in an inconsistent state. To fix it, we need │
   │ to create a new backup. Older messages may not come back.       │
   │                                  [Learn more]   [Fix encryption]│
   └────────────────────────────────────────────────────────────────┘
   ```

   - Wording is symptom-first, action-second.
   - "Learn more" links to a doc like this one.
   - "Fix encryption" is the entry point, not "Reset backup."

2. **Confirmation modal** when "Fix encryption" is clicked:

   - Plain-language explanation of what will and won't be recovered.
   - A bulleted "what you'll keep" / "what you may lose" comparison — concrete, not jargon.
   - **Required:** type the recovery key. Do not pre-fill.
   - **Optional but recommended:** require typing the word `RESET` to enable the destructive button.
   - Primary CTA labelled "Reset key backup" with a destructive color.

3. **Settings (Advanced / Encryption section)** — secondary entry point for the same flow, behind two nav layers and an "Advanced" disclosure. Power users / support agents can find it; new users won't stumble in.

4. **Never** put it in the top-level navigation, header, or any always-visible toolbar of a product used by non-technical users.

### Anti-patterns to avoid

- **"Reset" as a single button next to "Sign out".** Implies they're equivalent operations; they aren't.
- **Auto-reset on backup error.** Too destructive to do silently. Always require user consent.
- **A `confirm()` dialog.** Browsers de-emphasize them; users dismiss without reading.
- **Hiding the cost.** "Reset backup?" with no body text is malpractice for a destructive action.
- **Allowing reset while the user is locked.** If the recovery key isn't validated, you can't write the new backup key into SSSS — you'll just create a half-broken state. Validate the recovery key inside the same flow.

### Telemetry & support

- Log the *trigger* error code (e.g. `DecryptionKeyDoesNotMatchError`) and the user's `device_id` before the reset. Without this, support can't tell whether the reset was justified or panic-clicked.
- After reset, capture the `version` returned by `resetKeyBackup` so you can correlate later issues.
- Don't log the recovery key or backup decryption key. Ever.

### Recovery path after reset

Right after a successful reset:

- The user's *other* devices will, on next sync, see the new backup version (`KeyBackupSessionsRemaining` event fires as they upload sessions they still hold).
- This device should automatically pull anything that lands in the new backup via the SDK's on-demand downloader, but a manual "retry decryption" is cheap insurance:

  ```ts
  for (const room of client.getRooms()) {
    await room.decryptAllEvents();
  }
  ```

- Show progress: "Restoring keys… 12 of 200" via `KeyBackupSessionsRemaining` events, otherwise the user will think nothing's happening.

## TL;DR

`Reset backup` rebuilds the bridge between your SSSS-stored recovery key and the server's key backup. Use it when those two stop matching. In production, gate it behind detection of the broken state, a clear explanation of the trade-offs, and a recovery-key reprompt. Never expose it as a casual toolbar action.
