import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FeedEvent, FeedEventKind } from "../types";
import { S } from "./styles";
import { Message } from "./message";
import { IconChatDots } from "./icons";
import { KIND_TEXT, KIND_TONE } from "./tones";

/** Kinds shown as filter chips, in the same order the tones map declares them. */
const KINDS = Object.keys(KIND_TEXT) as FeedEventKind[];

/** The chat feed of state transitions, sticking to the newest message. */
export function FlowView({ events }: { events: FeedEvent[] }) {
  // Filter state is local to the feed — kinds toggled off are hidden, and the
  // query matches an event's label or (for actions) the action name.
  const [hidden, setHidden] = useState<Set<FeedEventKind>>(() => new Set());
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (hidden.has(e.kind)) return false;
      if (!q) return true;
      return (
        e.label.toLowerCase().includes(q) ||
        (e.action?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [events, hidden, query]);

  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered.length]);

  const toggleKind = (kind: FeedEventKind) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });

  return (
    <>
      <div style={S.filterBar}>
        {KINDS.map((kind) => {
          const active = !hidden.has(kind);
          const tone = KIND_TONE[kind];
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              title={active ? `Hide ${KIND_TEXT[kind]}` : `Show ${KIND_TEXT[kind]}`}
              style={{
                ...S.filterChip,
                ...(active
                  ? { color: tone.fg, background: tone.soft, borderColor: tone.border, opacity: 1 }
                  : null),
              }}
            >
              {KIND_TEXT[kind]}
            </button>
          );
        })}
        <input
          style={S.filterSearch}
          placeholder="Filter by label…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {events.length === 0 ? (
        <EmptyFeed />
      ) : filtered.length === 0 ? (
        <NoMatches />
      ) : (
        <div ref={ref} style={S.scroll} className="pf-scroll">
          {filtered.map((e) => (
            <Message key={e.id} event={e} />
          ))}
        </div>
      )}
    </>
  );
}

/** Shown before any event has arrived. */
function EmptyFeed() {
  return (
    <div style={S.empty}>
      <div style={{ marginBottom: 10, color: "var(--muted-foreground, #a1a1a1)" }}>
        <IconChatDots size={36} />
      </div>
      Watching {`{`} atoms {`}`} for state changes…
      <div style={S.emptyHint}>
        Interact with the app — every atom resolve &amp; value change lands here.
      </div>
    </div>
  );
}

/** Shown when there are events but the active filter hides them all. */
function NoMatches() {
  return (
    <div style={S.empty}>
      No events match the filter.
      <div style={S.emptyHint}>Re-enable a kind chip or clear the search above.</div>
    </div>
  );
}
