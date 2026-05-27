import { AppShell } from "@/features/clinic/app-shell";
import { AccountMenu } from "@/features/clinic/account-menu";

export default function Home() {
  return (
    <AppShell>
      <AccountMenu />
    </AppShell>
  );
}
