import { AppShell } from "@/components/app-shell";
import { ClinicGuard } from "@/components/clinic-guard";
import { PatientTable } from "@/components/patient-table";

export default function PatientsPage() {
  return (
    <AppShell>
      <ClinicGuard>
        <PatientTable />
      </ClinicGuard>
    </AppShell>
  );
}
