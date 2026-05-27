import { AppShell } from "@/features/clinic/app-shell";
import { ClinicGuard } from "@/features/clinic/clinic-guard";
import { PatientTable } from "@/features/patient/patient-table";

export default function PatientsPage() {
  return (
    <AppShell>
      <ClinicGuard>
        <PatientTable />
      </ClinicGuard>
    </AppShell>
  );
}
