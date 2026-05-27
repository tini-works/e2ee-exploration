export type PeerKeyShareState =
  | { kind: "idle" }
  | { kind: "requesting"; sentAt: number }
  | { kind: "received"; receivedAt: number }
  | { kind: "imported"; importedAt: number }
  | { kind: "no-responders" }
  | { kind: "timeout" }
  | { kind: "error"; message: string };

export type RequestKeyArgs = {
  /** The user whose devices we ask. Usually the message's sender. */
  fromUserId: string;
  roomId: string;
  sessionId: string;
  senderKey: string;
};
