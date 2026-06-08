import type { ReactNode } from "react";
import { S } from "./styles";

export function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...S.tab, ...(active ? S.tabActive : null) }}
    >
      {children}
    </button>
  );
}
