# pumped-devtools

A zero-config, floating **chat-bubble inspector** for [`@pumped-fn/lite-react`](https://www.npmjs.com/package/@pumped-fn/lite-react). Drop it inside a `ScopeProvider` and watch your atoms change in real time.

- 🫧 **Collapsed**: a round button docked bottom-left, with a badge counting value-changes.
- 💬 **Expanded**: a big speech bubble with two views.
  - **State** — every atom's current lifecycle (`idle / resolving / resolved / failed`) and value preview. Click a row to expand long values.
  - **Flow** — a chat feed of every transition, newest at the bottom. Because derived atoms re-resolve when a watched dependency changes, the feed makes the **reactive cascade** visible: a write to one atom shows up, then each watcher `resolving` → `changed`.

It owns nothing in your app: it reads the scope from context, subscribes one `Controller` per atom, and renders self-contained inline styles (no CSS/Tailwind dependency).

## Usage

```tsx
import { ScopeProvider } from "@pumped-fn/lite-react";
import { PumpedDevtools } from "pumped-devtools";
import { countAtom, userAtom, readinessAtom } from "./state";

<ScopeProvider scope={scope}>
  <App />
  <PumpedDevtools
    atoms={{ countAtom, userAtom, readinessAtom }} // atoms are nameless → label them
    title="my-app"
    defaultOpen={false}
  />
</ScopeProvider>;
```

> Mount it only in development (e.g. `process.env.NODE_ENV !== "production"`).

### Props

| prop          | default       | meaning                                                                     |
| ------------- | ------------- | --------------------------------------------------------------------------- |
| `atoms`       | —             | `Record<label, Atom>` to watch (required)                                   |
| `title`       | `"pumped-fn"` | panel heading                                                               |
| `side`        | `"left"`      | initial bottom corner (`"left"` \| `"right"`) — toggle live from the header |
| `size`        | `"md"`        | initial UI size (`"sm"` \| `"md"` \| `"lg"`) — cycle live from the header   |
| `maxEvents`   | `250`         | flow feed ring-buffer size                                                  |
| `defaultOpen` | `false`       | start expanded                                                              |
| `scope`       | context       | override the scope instead of reading `ScopeProvider`                       |

Position (left ⇄ right) and size (S / M / L) are also adjustable at runtime from the panel header — the props just seed the initial values.

## Lower-level

`usePumpedFeed(atoms, opts)` returns `{ state, clear }` (atom snapshots + flow events) so you can build your own UI on the same engine. `PumpedFeedStore` is the framework-agnostic core.

## How it works

pumped-fn atoms are observed through `scope.controller(atom)`:

- `controller.state` → the lifecycle pill.
- `controller.get()` → the value preview (guarded; throws while `idle`/`failed`).
- `controller.on("*", …)` → fires on every `resolving` and `resolved` transition; the store diffs the value to decide `changed` vs `re-resolved`.

The snapshot is exposed to React via `useSyncExternalStore`, so reads are tear-free and StrictMode-safe.
