import { S } from "./styles";
import { IconBubble, IconChevron } from "./icons";

/** Collapsed floating button with a value-change badge. */
export function Fab({
  open,
  changes,
  onClick,
}: {
  open: boolean;
  changes: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={open ? "Hide pumped-fn devtools" : "Show pumped-fn devtools"}
      style={{ ...S.fab, ...(open ? S.fabOpen : null) }}
    >
      {open ? <IconChevron /> : <IconBubble />}
      {!open && changes > 0 && (
        <span style={S.fabBadge}>{changes > 99 ? "99+" : changes}</span>
      )}
    </button>
  );
}
