"use client";

import { useState } from "react";
import { useMatrix } from "@/lib/matrix/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_HOMESERVER_URL,
  DEFAULT_IDENTITY_SERVER_URL,
} from "@/lib/matrix/types";
import { toast } from "sonner";

export function SignIn() {
  const { signIn, status, error } = useMatrix();
  const [baseUrl, setBaseUrl] = useState(DEFAULT_HOMESERVER_URL);
  const [identityServerUrl, setIdentityServerUrl] = useState(
    DEFAULT_IDENTITY_SERVER_URL,
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn({
        baseUrl: baseUrl.trim(),
        identityServerUrl: identityServerUrl.trim() || undefined,
        username: username.trim(),
        password,
      });
      toast.success("Signed in. Enter your recovery key from the status bar to unlock encrypted history.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold">Sign in to Matrix</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each browser gets its own device. Use your Matrix username and
            password.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="baseUrl">Homeserver</Label>
          <Input
            id="baseUrl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="identityServerUrl">Identity server</Label>
          <Input
            id="identityServerUrl"
            value={identityServerUrl}
            onChange={(e) => setIdentityServerUrl(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@alice:matrix.org or alice"
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <p className="text-sm text-destructive break-words">{error}</p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || status === "connecting"}
        >
          {submitting || status === "connecting" ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
