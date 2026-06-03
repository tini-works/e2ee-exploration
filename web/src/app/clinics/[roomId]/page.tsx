import { AppShell } from "@/features/clinic/app-shell";
import { PatientDetail } from "@/features/patient/patient-detail";

export default async function ClinicRecordPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return (
    <AppShell>
      <PatientDetail roomId={decodeURIComponent(roomId)} variant="patient" />
    </AppShell>
  );
}
