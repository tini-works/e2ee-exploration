"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { matrixReact } from "matrix-client/react";
import { matrixCrypto } from "matrix-client/crypto";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

/**
 * One-shot flag set by the sign-in flow so we prompt for the recovery key
 * after an actual login — but NOT on a plain page refresh.
 */
export const RECOVERY_PROMPT_KEY = "patient-records:recovery-key-prompt";

type RecoveryKeyContextValue = {
  openRecoveryKey: () => void;
  openResetBackup: () => void;
};

const RecoveryKeyContext = createContext<RecoveryKeyContextValue | null>(null);

export function useRecoveryKey() {
  const ctx = useContext(RecoveryKeyContext);
  if (!ctx)
    throw new Error("useRecoveryKey must be used within a RecoveryKeyProvider.");
  return ctx;
}

export function RecoveryKeyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { client, status, ready, resetBackup, markKeyUnlocked } =
    matrixReact.useMatrix();

  const [keyOpen, setKeyOpen] = useState(false);
  const [keying, setKeying] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [genPassword, setGenPassword] = useState("");
  // null = still probing; true = SSSS exists (Enter mode); false = no SSSS.
  const [hasSSSS, setHasSSSS] = useState<boolean | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSecurityKey, setResetSecurityKey] = useState("");

  // Prompt for the recovery key once right after a sign-in (flagged by the
  // sign-in flow), but only while the store is still locked. A plain refresh
  // carries no flag, so it won't re-prompt.
  const autoPrompted = useRef(false);
  useEffect(() => {
    const maybePrompt = () => {
      if (autoPrompted.current || status !== "ready") return;
      autoPrompted.current = true;
      let pending = false;
      try {
        pending = sessionStorage.getItem(RECOVERY_PROMPT_KEY) === "1";
        sessionStorage.removeItem(RECOVERY_PROMPT_KEY);
      } catch {
        // sessionStorage unavailable — skip the auto-prompt
      }
      if (pending && !ready) setKeyOpen(true);
    };
    maybePrompt();
  }, [status, ready]);

  useEffect(() => {
    let cancelled = false;
    const probe = () => {
      if (!keyOpen || !client) {
        setHasSSSS(null);
        return;
      }
      setHasSSSS(null);
      void matrixCrypto.hasSecretStorage(client).then((v) => {
        if (!cancelled) setHasSSSS(v);
      });
    };
    probe();
    return () => {
      cancelled = true;
    };
  }, [keyOpen, client]);

  const closeKey = () => {
    setKeyOpen(false);
    setKeyValue("");
    setGenPassword("");
    setGeneratedKey(null);
  };

  const confirmKey = async () => {
    if (!client || !keyValue.trim()) return;
    setKeying(true);
    try {
      const outcome = await matrixCrypto.unlockWithSecurityKey(
        client,
        keyValue.trim(),
      );
      markKeyUnlocked();
      const imported = outcome.keyBackupRestored?.imported ?? 0;
      toast.success(
        imported > 0
          ? `Unlocked. Restored ${imported} message key${imported === 1 ? "" : "s"} from backup.`
          : "Unlocked.",
      );
      closeKey();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setKeying(false);
    }
  };

  const confirmGenerate = async () => {
    if (!client || !genPassword) return;
    setKeying(true);
    try {
      const { recoveryKey } = await matrixCrypto.generateRecoveryKey(client, {
        password: genPassword,
      });
      setGeneratedKey(recoveryKey);
      setGenPassword("");
      markKeyUnlocked();
      toast.success("Recovery key generated. Save it before closing.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setKeying(false);
    }
  };

  const copyGenerated = async () => {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey);
      toast.success("Copied to clipboard.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const closeReset = () => {
    setResetOpen(false);
    setResetSecurityKey("");
  };

  const confirmReset = async () => {
    if (!resetSecurityKey.trim()) return;
    setResetting(true);
    try {
      await resetBackup(resetSecurityKey.trim());
      toast.success(
        "Backup reset. Other devices will re-upload their keys here.",
      );
      closeReset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setResetting(false);
    }
  };

  return (
    <RecoveryKeyContext.Provider
      value={{
        openRecoveryKey: () => setKeyOpen(true),
        openResetBackup: () => setResetOpen(true),
      }}
    >
      {children}

      <Dialog
        open={keyOpen}
        onOpenChange={(o) => {
          if (keying) return;
          if (!o) closeKey();
          else setKeyOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          {generatedKey ? (
            <>
              <DialogHeader>
                <DialogTitle>Save your recovery key</DialogTitle>
                <DialogDescription>
                  Write this down or copy it to a password manager. This is the
                  only time it will be shown. Without it you can&apos;t read
                  encrypted messages on other devices.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
                {generatedKey}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={copyGenerated}>
                  Copy
                </Button>
                <Button onClick={closeKey}>I&apos;ve saved it</Button>
              </div>
            </>
          ) : hasSSSS === null ? (
            <DialogHeader>
              <DialogTitle>Recovery key</DialogTitle>
              <DialogDescription>
                Checking your account&apos;s secret storage…
              </DialogDescription>
            </DialogHeader>
          ) : hasSSSS ? (
            <>
              <DialogHeader>
                <DialogTitle>Enter recovery key</DialogTitle>
                <DialogDescription>
                  Loads the backup decryption key into this browser&apos;s
                  crypto store so messages sent from other devices can be
                  decrypted.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="cache-security-key" className="text-xs">
                  Recovery key
                </Label>
                <PasswordInput
                  id="cache-security-key"
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  placeholder="EsTz cDAu oLhr WV1d …"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={keying}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeKey} disabled={keying}>
                  Cancel
                </Button>
                <Button
                  onClick={confirmKey}
                  disabled={keying || !keyValue.trim()}
                >
                  {keying ? "Unlocking…" : "Unlock"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Set up recovery key</DialogTitle>
                <DialogDescription>
                  Your account doesn&apos;t have secret storage set up yet.
                  Generate a recovery key to enable encrypted backups and
                  cross-device decryption.
                </DialogDescription>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                We&apos;ll create a new secret storage entry, store your
                cross-signing keys in it, and create a new key backup — all
                encrypted under the recovery key shown next. Your password is
                needed to authorize uploading the cross-signing public keys to
                the server.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="gen-password" className="text-xs">
                  Account password
                </Label>
                <PasswordInput
                  id="gen-password"
                  value={genPassword}
                  onChange={(e) => setGenPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={keying}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeKey} disabled={keying}>
                  Cancel
                </Button>
                <Button
                  onClick={confirmGenerate}
                  disabled={keying || !genPassword}
                >
                  {keying ? "Generating…" : "Generate recovery key"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetOpen}
        onOpenChange={(o) => {
          if (resetting) return;
          if (!o) closeReset();
          else setResetOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Reset key backup?</DialogTitle>
            <DialogDescription>
              This creates a new server-side backup version and stores a fresh
              decryption key in your secret storage. Use this only when the
              current backup is in a broken state (e.g. the recovery key
              doesn&apos;t match the backup).
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>
              <span className="font-medium text-foreground">What changes:</span>{" "}
              the previous backup is replaced. Other devices will detect the new
              version and re-upload their message keys.
            </p>
            <p>
              <span className="font-medium text-foreground">What you lose:</span>{" "}
              any Megolm sessions that lived only in the old backup are
              unreachable. Past messages where the sender device still has the
              session locally will eventually become readable again.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-security-key" className="text-xs">
              Recovery key (needed to encrypt the new backup key into SSSS)
            </Label>
            <PasswordInput
              id="reset-security-key"
              value={resetSecurityKey}
              onChange={(e) => setResetSecurityKey(e.target.value)}
              placeholder="EsTz cDAu oLhr WV1d …"
              autoComplete="off"
              spellCheck={false}
              disabled={resetting}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeReset} disabled={resetting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReset}
              disabled={resetting || !resetSecurityKey.trim()}
            >
              {resetting ? "Resetting…" : "Reset backup"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RecoveryKeyContext.Provider>
  );
}
