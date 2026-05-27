export type RoomEventExport = {
  eventId: string | undefined;
  type: string;
  stateKey: string | undefined;
  sender: string | undefined;
  ts: number;
  content: unknown;
  unsigned: unknown;
  isEncrypted: boolean;
  decryptionFailureReason: string | null;
  wireContent: unknown;
};
