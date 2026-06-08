import type { AtomLifecycle } from "../types";
import { S } from "./styles";
import { STATE_TONE } from "./tones";

export function StatePill({ state }: { state: AtomLifecycle }) {
  const tone = STATE_TONE[state];
  return (
    <span style={{ ...S.pill, color: tone.fg, background: tone.soft }}>
      <span style={{ ...S.pillDot, background: tone.fg }} />
      {state}
    </span>
  );
}
