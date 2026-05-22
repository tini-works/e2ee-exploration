"use client";

import Link from "next/link";
import { useMatrix } from "@/lib/matrix/provider";
import { isClinicUser } from "@/lib/config";
import { Button } from "@/components/ui/button";

export function ClinicGuard({ children }: { children: React.ReactNode }) {
  const { session } = useMatrix();

  if (!isClinicUser(session?.userId)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Clinic access only</h1>
        <p className="text-sm text-muted-foreground">
          Your account{" "}
          <span className="font-mono">{session?.userId ?? "(unknown)"}</span>{" "}
          isn&apos;t registered as a clinic. The patient list is restricted to
          clinic operators.
        </p>
        <Button variant="outline" render={<Link href="/">Back to your account</Link>} />
      </div>
    );
  }

  return <>{children}</>;
}
