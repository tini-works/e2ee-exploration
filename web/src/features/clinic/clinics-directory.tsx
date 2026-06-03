"use client";

import { CopyIcon } from "lucide-react";
import { CLINICS } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err));
  }
}

export function ClinicsDirectory() {
  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Clinics directory
        </h1>
        <p className="text-sm text-muted-foreground">
          {CLINICS.length} clinic{CLINICS.length === 1 ? "" : "s"} registered in
          this app.
        </p>
      </section>

      {CLINICS.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No clinics are configured yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {CLINICS.map((clinic) => (
            <li
              key={clinic.userId}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{clinic.name}</div>
                <button
                  type="button"
                  onClick={() => copy(clinic.userId, "Clinic ID")}
                  title="Copy clinic ID"
                  className="group mt-0.5 inline-flex max-w-full items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="truncate">{clinic.userId}</span>
                  <CopyIcon className="size-3 shrink-0 opacity-60 group-hover:opacity-100" />
                </button>
              </div>
              <Badge variant="secondary">Clinic</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
