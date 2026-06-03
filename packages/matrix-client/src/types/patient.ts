export type MatrixPatientRecord = {
  firstName: string;
  lastName: string;
  dob?: string;
  phone?: string;
  email?: string;
  notes?: string;
  updatedAt: string;
  updatedTimes: number;
};

export type MatrixPatientRecordRevision = MatrixPatientRecord & {
  eventId: string;
  sender: string;
  ts: number;
  isRoot: boolean;
};

export type MatrixPatient = {
  roomId: string;
  record: MatrixPatientRecord;
};

export type MatrixPendingInvite = {
  roomId: string;
  name: string;
  inviterId: string | null;
};
