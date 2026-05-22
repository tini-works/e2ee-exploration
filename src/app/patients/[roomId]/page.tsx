import { AppShell } from "@/components/app-shell";
import { PatientDetail } from "@/components/patient-detail";

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
