"use client";

import { scopedValue, useScopedValue } from "@pumped-fn/lite-react";
import { matrixReact } from "matrix-client/react";
import {
  DEFAULT_HOMESERVER_URL,
  DEFAULT_IDENTITY_SERVER_URL,
} from "matrix-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { RECOVERY_PROMPT_KEY } from "@/features/clinic/recovery-key-provider";
import { ShieldCheckIcon } from "lucide-react";
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
        await matrixReact.signIn({
          baseUrl: s.baseUrl.trim(),
          identityServerUrl: s.identityServerUrl.trim() || undefined,
          username: s.username.trim(),
          password: s.password,
        });
        try {
          sessionStorage.setItem(RECOVERY_PROMPT_KEY, "1");
        } catch {
          // sessionStorage unavailable — recovery key can still be entered
          // from the account menu
        }
        toast.success("Signed in.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        patch({ submitting: false });
      }
    },
  }),
});

export function SignIn() {
  const { status, error } = matrixReact.useMatrix();
  const form = useScopedValue(signInForm);
  const { baseUrl, identityServerUrl, username, password, submitting } =
    form.snapshot;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void form.actions.submit();
  };

  return (
    <div className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 bg-muted/30 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <ShieldCheckIcon className="size-6" />
        </div>
        <div>
          <h1 className="font-heading text-xl font-semibold">
            Patient Records
          </h1>
          <p className="text-sm text-muted-foreground">
            End-to-end encrypted records over Matrix
          </p>
        </div>
      </div>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-5 rounded-xl border bg-card p-6 shadow-sm sm:p-8"
      >
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold">Sign in</h2>
          <p className="text-sm text-muted-foreground">
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
