"use client";

/**
 * pumped-devtools — a floating chat-bubble inspector for @pumped-fn/lite-react.
 *
 *   import { PumpedDevtools } from "pumped-devtools";
 *
 *   <ScopeProvider scope={scope}>
 *     <App />
 *     <PumpedDevtools atoms={{ countAtom, userAtom, readinessAtom }} />
 *   </ScopeProvider>
 *
 * Atoms carry no name, so pass a label -> atom map. The bubble docks bottom-left;
 * expand it for a live State view and a Flow feed of every resolve / value change.
 */
export { PumpedDevtools } from "./devtools";
export type { PumpedDevtoolsProps } from "./devtools";
export type { DevtoolsSide, DevtoolsSize } from "./components/sizes";

// Lower-level surface, if you want to build your own UI on the same feed.
export { usePumpedFeed } from "./use-pumped-feed";
export type { UsePumpedFeedResult } from "./use-pumped-feed";
export { PumpedFeedStore } from "./store";
export { previewValue } from "./preview";
export type {
  AtomRegistry,
  ScopedValueRegistry,
  AtomLifecycle,
  AtomSnapshot,
  FormSnapshot,
  FeedEvent,
  FeedEventKind,
  FeedOptions,
  FeedState,
} from "./types";
