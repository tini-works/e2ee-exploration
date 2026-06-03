"use client";

import {
  matrixPatient,
  type MatrixPatientRecordRevision,
} from "matrix-client/patient";
import { Badge } from "@/components/ui/badge";

const RECORD_FIELDS = [
  "firstName",
  "lastName",
  "dob",
  "phone",
  "email",
  "notes",
] as const;
type RecordField = (typeof RECORD_FIELDS)[number];

function diffRevisions(
  current: MatrixPatientRecordRevision,
  previous: MatrixPatientRecordRevision | null,
): { field: RecordField; from: string; to: string }[] {
  if (!previous) return [];
  const out: { field: RecordField; from: string; to: string }[] = [];
  for (const f of RECORD_FIELDS) {
    const a = (previous[f] ?? "") as string;
    const b = (current[f] ?? "") as string;
    if (a !== b) out.push({ field: f, from: a, to: b });
  }
  return out;
}

/** Newest-first list of patient profile revisions with per-field diffs. */
export function ProfileHistory({
  history,
  currentSelf,
}: {
  history: MatrixPatientRecordRevision[];
  currentSelf: string | null;
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Profile history</h2>
        <p className="text-xs text-muted-foreground">
          {history.length === 0
            ? "No revisions yet."
            : `${history.length} revision${history.length === 1 ? "" : "s"} — newest first`}
        </p>
      </div>
      {history.length > 0 && (
        <ol className="divide-y max-h-[480px] overflow-y-auto">
          {history.map((rev, i) => {
            const previous = history[i + 1] ?? null;
            const changes = diffRevisions(rev, previous);
            const isMe = rev.sender === currentSelf;
            return (
              <li key={rev.eventId} className="px-4 py-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {new Date(rev.ts).toLocaleString()}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {isMe ? "you" : rev.sender}
                    </span>
                  </div>
                  {rev.isRoot && (
                    <Badge variant="secondary" className="text-xs">
                      Initial
                    </Badge>
                  )}
                </div>
                {rev.isRoot || !previous ? (
                  <div className="text-muted-foreground">
                    Created with name{" "}
                    <span className="font-medium">
                      {matrixPatient.fullName(rev)}
                    </span>
                    .
                  </div>
                ) : changes.length === 0 ? (
                  <div className="text-muted-foreground italic">
                    No field changes (resaved).
                  </div>
                ) : (
                  <ul className="space-y-0.5">
                    {changes.map((c) => (
                      <li key={c.field} className="font-mono text-xs">
                        <span className="text-muted-foreground">
                          {c.field}:{" "}
                        </span>
                        <span className="line-through text-muted-foreground/70">
                          {c.from || "∅"}
                        </span>
                        <span className="mx-1">→</span>
                        <span>{c.to || "∅"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
