import { AppShell } from "@/features/clinic/app-shell";
import { ClinicsDirectory } from "@/features/clinic/clinics-directory";

export default function DirectoryPage() {
  return (
    <AppShell>
      <ClinicsDirectory />
    </AppShell>
  );
}
