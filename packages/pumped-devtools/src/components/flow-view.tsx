import { useLayoutEffect, useRef } from "react";
import type { FeedEvent } from "../types";
import { S } from "./styles";
import { Message } from "./message";
import { IconChatDots } from "./icons";

/** The chat feed of state transitions, sticking to the newest message. */
export function FlowView({ events }: { events: FeedEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  if (events.length === 0) {
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

  return (
    <div ref={ref} style={S.scroll} className="pf-scroll">
      {events.map((e) => (
        <Message key={e.id} event={e} />
      ))}
    </div>
  );
}
