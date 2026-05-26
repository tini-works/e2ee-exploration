"use client";

import { useEffect } from "react";
import { useMatrix } from "matrix-client/react";
import { SignIn } from "./sign-in";
import { StatusBar } from "./status-bar";
import { FullPageLoader } from "./full-page-loader";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, session, error, pendingBackup } = useMatrix();

  useEffect(() => {
    if (pendingBackup <= 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pendingBackup]);

  if (status === "initializing") {
    return <FullPageLoader />;
  }

  if (status === "connecting") {
    return <FullPageLoader label="Connecting to Matrix…" />;
  }

  if (status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="text-destructive font-medium">
          Couldn't connect to Matrix
        </div>
        <div className="text-sm text-muted-foreground max-w-md text-center break-words">
          {error ?? "Unknown error."}
        </div>
        <SignIn />
      </div>
    );
  }

  if (!session || status !== "ready") {
    return <SignIn />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card/50">
        <div className="mx-auto w-full max-w-6xl px-8 py-3">
          <StatusBar />
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl p-8">{children}</main>
    </div>
  );
}
