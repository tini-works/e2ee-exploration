import { AppShell } from "@/components/app-shell";
import { PatientAccount } from "@/components/patient-account";

export default function Home() {
  return (
    <AppShell>
      <PatientAccount />
    </AppShell>
  );
}
