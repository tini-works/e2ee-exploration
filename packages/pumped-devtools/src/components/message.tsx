import type { FeedEvent } from "../types";
import { S } from "./styles";
import { KIND_TEXT, KIND_TONE } from "./tones";
import { fmtTime } from "./format";

/** One flow event as a chat message: avatar + label/kind/time + value bubble. */
export function Message({ event }: { event: FeedEvent }) {
  const tone = KIND_TONE[event.kind];
  // `value` (atom) and `form` (scopedValue) both render an old → new diff.
  const isDiff =
    (event.kind === "value" || event.kind === "form") &&
    event.prev !== undefined;
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
          {event.kind === "action" ? (
            <code style={{ ...S.nextVal, color: tone.fg }}>
              {event.action}
              <span style={S.arrow}>(</span>
              {event.value}
              <span style={S.arrow}>)</span>
            </code>
          ) : isDiff ? (
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
          {event.detail && <div style={S.detail}>{event.detail}</div>}
        </div>
      </div>
    </div>
  );
}
