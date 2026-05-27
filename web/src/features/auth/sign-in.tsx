"use client";

import { scopedValue, useScopedValue } from "@pumped-fn/lite-react";
import { useMatrix, signIn } from "matrix-client/react";
import {
  DEFAULT_HOMESERVER_URL,
  DEFAULT_IDENTITY_SERVER_URL,
} from "matrix-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/**
 * Sign-in form state lives in a pumped scopedValue (execution-scoped frontend
 * state) rather than a pile of useState. The submit action drives the
 * matrix-client signIn() directly.
 */
const signInForm = scopedValue({
  name: "sign-in-form",
  initial: () => ({
    baseUrl: DEFAULT_HOMESERVER_URL,
    identityServerUrl: DEFAULT_IDENTITY_SERVER_URL,
    username: "",
    password: "",
    submitting: false,
  }),
  actions: ({ get, patch }) => ({
    setBaseUrl: (baseUrl: string) => patch({ baseUrl }),
    setIdentityServerUrl: (identityServerUrl: string) =>
      patch({ identityServerUrl }),
    setUsername: (username: string) => patch({ username }),
    setPassword: (password: string) => patch({ password }),
    async submit() {
      const s = get();
      patch({ submitting: true });
      try {
        await signIn({
          baseUrl: s.baseUrl.trim(),
          identityServerUrl: s.identityServerUrl.trim() || undefined,
          username: s.username.trim(),
          password: s.password,
        });
        toast.success(
          "Signed in. Enter your recovery key from the status bar to unlock encrypted history.",
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        patch({ submitting: false });
      }
    },
  }),
});

export function SignIn() {
  const { status, error } = useMatrix();
  const form = useScopedValue(signInForm);
  const { baseUrl, identityServerUrl, username, password, submitting } =
    form.snapshot;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void form.actions.submit();
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
            onChange={(e) => form.actions.setBaseUrl(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="identityServerUrl">Identity server</Label>
          <Input
            id="identityServerUrl"
            value={identityServerUrl}
            onChange={(e) => form.actions.setIdentityServerUrl(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => form.actions.setUsername(e.target.value)}
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
            onChange={(e) => form.actions.setPassword(e.target.value)}
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
