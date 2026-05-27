import { AppShell } from "@/features/clinic/app-shell";
import { PatientDetail } from "@/features/patient/patient-detail";

export default async function PatientPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return (
    <AppShell>
      <PatientDetail roomId={decodeURIComponent(roomId)} />
    </AppShell>
  );
}
