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
