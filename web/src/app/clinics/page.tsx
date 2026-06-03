import { AppShell } from "@/features/clinic/app-shell";
import { PatientClinics } from "@/features/clinic/patient-clinics";

export default function ClinicsPage() {
  return (
    <AppShell>
      <PatientClinics />
    </AppShell>
  );
}
