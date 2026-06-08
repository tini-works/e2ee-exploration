/** Keyframes, hover states and scrollbar styling, injected once with the tree. */
export function StyleOnce() {
  return (
    <style>{`
@keyframes pf-pop { from { opacity:0; transform: translateY(8px) scale(.98); } to { opacity:1; transform:none; } }
@keyframes pf-in { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform:none; } }
.pf-pop { animation: pf-pop .18s cubic-bezier(.2,.9,.3,1) both; }
.pf-msg { animation: pf-in .18s ease both; }
.pf-row:hover { background: color-mix(in srgb, var(--foreground, #fafafa) 6%, transparent) !important; }
.pf-icon:hover { color: var(--foreground, #fafafa) !important; background: color-mix(in srgb, var(--foreground, #fafafa) 9%, transparent) !important; }
.pf-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.pf-scroll::-webkit-scrollbar { width: 0; height: 0; display: none; }
`}</style>
  );
}
