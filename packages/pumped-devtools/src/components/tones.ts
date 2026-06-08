import type { AtomLifecycle, FeedEventKind } from "../types";
import { SEM, soft, T } from "./theme";

/** Colors for the lifecycle pill in the State view. */
export const STATE_TONE: Record<AtomLifecycle, { fg: string; soft: string }> = {
  resolved: { fg: SEM.green, soft: soft(SEM.green, 14) },
  resolving: { fg: SEM.amber, soft: soft(SEM.amber, 14) },
  failed: { fg: T.danger, soft: soft(T.danger, 16) },
  idle: { fg: T.muted, soft: soft(T.muted, 16) },
};

/** Colors + border for each flow-event kind in the chat feed. */
export const KIND_TONE: Record<FeedEventKind, { fg: string; soft: string; border: string }> = {
  // A value change is the headline event → the app's blue primary.
  value: { fg: T.primary, soft: soft(T.primary, 18), border: soft(T.primary, 38) },
  resolving: { fg: SEM.amber, soft: soft(SEM.amber, 14), border: soft(SEM.amber, 26) },
  resolved: { fg: T.muted, soft: soft(T.muted, 16), border: soft(T.muted, 24) },
  failed: { fg: T.danger, soft: soft(T.danger, 16), border: soft(T.danger, 40) },
  // scopedValue state patches (cyan) and action invocations (violet).
  form: { fg: SEM.cyan, soft: soft(SEM.cyan, 16), border: soft(SEM.cyan, 32) },
  action: { fg: SEM.violet, soft: soft(SEM.violet, 18), border: soft(SEM.violet, 36) },
};

export const KIND_TEXT: Record<FeedEventKind, string> = {
  value: "changed",
  resolving: "resolving",
  resolved: "re-resolved",
  failed: "failed",
  form: "patched",
  action: "action",
};
