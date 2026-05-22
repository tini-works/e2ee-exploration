import { Loader2Icon } from "lucide-react";

export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[100dvh]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2Icon className="h-8 w-8 animate-spin" />
        {label ? <span className="text-sm">{label}</span> : null}
      </div>
    </div>
  );
}
