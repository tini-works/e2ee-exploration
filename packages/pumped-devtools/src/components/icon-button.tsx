import type { ReactNode } from "react";
import { S } from "./styles";

export function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" title={title} onClick={onClick} style={S.iconBtn} className="pf-icon">
      {children}
    </button>
  );
}
