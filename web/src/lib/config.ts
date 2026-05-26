export type Clinic = {
  name: string;
  userId: string;
};

export const CLINICS: Clinic[] = [
  {
    name: "Universitätsklinikum Hamburg-Eppendorf",
    userId: "@quochuydev.matrix:matrix.org",
  },
];

export function findClinicByUserId(
  userId: string | null | undefined,
): Clinic | null {
  if (!userId) return null;
  return CLINICS.find((c) => c.userId === userId) ?? null;
}

export function isClinicUser(userId: string | null | undefined): boolean {
  return findClinicByUserId(userId) !== null;
}
