export const PATIENT_TAG = "com.matrix-app.patient";
export const PATIENT_RECORD_EVENT_TYPE = "com.matrix-app.patient.record";
export const PROFILE_THREAD_STATE_TYPE = "com.matrix-app.patient.profile-thread";

export type PatientRecord = {
  firstName: string;
  lastName: string;
  dob?: string;
  phone?: string;
  email?: string;
  notes?: string;
  updatedAt: string;
  updatedTimes: number;
};

export function fullName(r: { firstName: string; lastName: string }): string {
  return `${r.firstName} ${r.lastName}`.trim();
}

export type PatientRecordRevision = PatientRecord & {
  eventId: string;
  sender: string;
  ts: number;
  isRoot: boolean;
};

export type Patient = {
  roomId: string;
  record: PatientRecord;
};

export type PendingInvite = {
  roomId: string;
  name: string;
  inviterId: string | null;
};

export type StoredSession = {
  baseUrl: string;
  identityServerUrl?: string;
  accessToken: string;
  userId: string;
  deviceId: string;
};

export const SESSION_STORAGE_KEY = "matrix-app.session";

export const DEFAULT_HOMESERVER_URL = "https://matrix-client.matrix.org";
export const DEFAULT_IDENTITY_SERVER_URL = "https://vector.im";
