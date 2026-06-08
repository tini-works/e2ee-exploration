import type { FeedEvent } from "../types";
import { S } from "./styles";
import { KIND_TEXT, KIND_TONE } from "./tones";
import { fmtTime } from "./format";

/** One flow event as a chat message: avatar + label/kind/time + value bubble. */
export function Message({ event }: { event: FeedEvent }) {
  const tone = KIND_TONE[event.kind];
  return (
    <div style={S.msg} className="pf-msg">
      <div style={{ ...S.avatar, background: tone.soft, color: tone.fg }}>
        {event.label.charAt(0).toUpperCase()}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={S.msgHead}>
          <span style={S.msgLabel}>{event.label}</span>
          <span style={{ ...S.kindTag, color: tone.fg, background: tone.soft }}>
            {KIND_TEXT[event.kind]}
          </span>
          <span style={S.msgTime}>{fmtTime(event.at)}</span>
        </div>
        <div style={{ ...S.bubble, borderColor: tone.border }}>
          {event.kind === "value" && event.prev !== undefined ? (
            <span>
              <code style={S.prevVal}>{event.prev}</code>
              <span style={S.arrow}> → </span>
              <code style={S.nextVal}>{event.value}</code>
            </span>
          ) : (
            <code style={event.kind === "failed" ? S.errVal : S.nextVal}>
              {event.value}
            </code>
          )}
        </div>
      </div>
    </div>
  );
}
