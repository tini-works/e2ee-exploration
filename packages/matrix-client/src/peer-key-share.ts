"use client";

import type { MatrixClient, MatrixEvent } from "matrix-js-sdk";

const LOG = (...args: unknown[]) => console.log("[peer-key-share]", ...args);
const LOG_ERR = (...args: unknown[]) =>
  console.error("[peer-key-share]", ...args);

const REQUEST_EVENT_TYPE = "m.app.key_request";
const RESPONSE_EVENT_TYPE = "m.app.key_forward";

const REQUEST_DEDUPE_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;

export type PeerKeyShareState =
  | { kind: "idle" }
  | { kind: "requesting"; sentAt: number }
  | { kind: "received"; receivedAt: number }
  | { kind: "imported"; importedAt: number }
  | { kind: "no-responders" }
  | { kind: "timeout" }
  | { kind: "error"; message: string };

type Listener = (state: PeerKeyShareState) => void;

type PeerKeyShareStore = {
  stateBySession: Map<string, PeerKeyShareState>;
  listenersBySession: Map<string, Set<Listener>>;
  pendingRequests: Map<
    string,
    { sessionId: string; timeout: ReturnType<typeof setTimeout> }
  >;
  lastRequestedAt: Map<string, number>;
};

const STORE_KEY = "__matrix_client_peer_key_share__";

function getStore(): PeerKeyShareStore {
  const g = globalThis as unknown as Record<string, PeerKeyShareStore>;
  let store = g[STORE_KEY];
  if (!store) {
    store = {
      stateBySession: new Map(),
      listenersBySession: new Map(),
      pendingRequests: new Map(),
      lastRequestedAt: new Map(),
    };
    g[STORE_KEY] = store;
  }
  return store;
}

const IDLE_STATE: PeerKeyShareState = { kind: "idle" };

function setState(sessionId: string, state: PeerKeyShareState) {
  const store = getStore();
  store.stateBySession.set(sessionId, state);
  const listeners = store.listenersBySession.get(sessionId);
  if (listeners) for (const l of listeners) l(state);
}

export function getPeerKeyShareState(sessionId: string): PeerKeyShareState {
  return getStore().stateBySession.get(sessionId) ?? IDLE_STATE;
}

export function subscribePeerKeyShareState(
  sessionId: string,
  listener: Listener,
): () => void {
  const store = getStore();
  let set = store.listenersBySession.get(sessionId);
  if (!set) {
    set = new Set();
    store.listenersBySession.set(sessionId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) store.listenersBySession.delete(sessionId);
  };
}

export type RequestKeyArgs = {
  /** The user whose devices we ask. Usually the message's sender. */
  fromUserId: string;
  roomId: string;
  sessionId: string;
  senderKey: string;
};

export async function requestKeyFromPeers(
  client: MatrixClient,
  { fromUserId, roomId, sessionId, senderKey }: RequestKeyArgs,
): Promise<void> {
  const ownUserId = client.getUserId();
  const ownDeviceId = client.getDeviceId();
  if (!ownUserId || !ownDeviceId) return;

  const store = getStore();
  const now = Date.now();
  const last = store.lastRequestedAt.get(sessionId) ?? 0;
  if (now - last < REQUEST_DEDUPE_MS) return;
  store.lastRequestedAt.set(sessionId, now);

  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${now}-${Math.random().toString(36).slice(2)}`;

  const crypto_ = client.getCrypto();
  if (!crypto_) {
    setState(sessionId, {
      kind: "error",
      message: "Crypto not initialized.",
    });
    return;
  }

  let recipientDeviceIds: string[] = [];
  try {
    const deviceMap = await crypto_.getUserDeviceInfo([fromUserId], true);
    const devices = deviceMap.get(fromUserId);
    if (devices) {
      for (const deviceId of devices.keys()) {
        if (fromUserId === ownUserId && deviceId === ownDeviceId) continue;
        recipientDeviceIds.push(deviceId);
      }
    }
  } catch (e) {
    LOG_ERR("getUserDeviceInfo failed", e);
  }

  if (recipientDeviceIds.length === 0) {
    setState(sessionId, { kind: "no-responders" });
    return;
  }

  setState(sessionId, { kind: "requesting", sentAt: now });
  store.pendingRequests.set(requestId, {
    sessionId,
    timeout: setTimeout(() => {
      store.pendingRequests.delete(requestId);
      const current = store.stateBySession.get(sessionId);
      if (current?.kind === "requesting") {
        setState(sessionId, { kind: "timeout" });
      }
    }, REQUEST_TIMEOUT_MS),
  });

  const content = {
    room_id: roomId,
    session_id: sessionId,
    sender_key: senderKey,
    request_id: requestId,
    requester_device_id: ownDeviceId,
  };
  const perDevice = new Map<string, Record<string, unknown>>();
  for (const deviceId of recipientDeviceIds) {
    perDevice.set(deviceId, content);
  }
  const contentMap = new Map<string, Map<string, Record<string, unknown>>>();
  contentMap.set(fromUserId, perDevice);

  try {
    await client.sendToDevice(REQUEST_EVENT_TYPE, contentMap);
    LOG(
      "sent",
      REQUEST_EVENT_TYPE,
      "to",
      fromUserId,
      "x",
      recipientDeviceIds.length,
      "devices for session",
      sessionId,
    );
  } catch (e) {
    LOG_ERR("sendToDevice request failed", e);
    const pending = store.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      store.pendingRequests.delete(requestId);
    }
    setState(sessionId, {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

type SessionKeyJson = {
  algorithm?: string;
  room_id?: string;
  sender_key?: string;
  session_id?: string;
  session_key?: string;
  sender_claimed_keys?: Record<string, string>;
  forwarding_curve25519_key_chain?: string[];
  [k: string]: unknown;
};

async function handleRequest(
  client: MatrixClient,
  event: MatrixEvent,
): Promise<void> {
  const requesterUserId = event.getSender();
  if (!requesterUserId) return;

  const content = event.getContent() as {
    room_id?: string;
    session_id?: string;
    sender_key?: string;
    request_id?: string;
    requester_device_id?: string;
  };
  const { room_id, session_id, sender_key, request_id, requester_device_id } =
    content;
  if (
    !room_id ||
    !session_id ||
    !sender_key ||
    !request_id ||
    !requester_device_id
  )
    return;

  // Policy: only share if the requester is a current member of the room.
  // Stops a random user from harvesting our session keys.
  const room = client.getRoom(room_id);
  if (!room) {
    LOG("ignoring request: not a member of room", room_id);
    return;
  }
  const member = room.getMember(requesterUserId);
  if (!member || (member.membership !== "join" && member.membership !== "invite")) {
    LOG(
      "ignoring request: requester",
      requesterUserId,
      "is not in room",
      room_id,
    );
    return;
  }

  const crypto_ = client.getCrypto();
  if (!crypto_) return;

  let allKeysJson: string;
  try {
    allKeysJson = await crypto_.exportRoomKeysAsJson();
  } catch (e) {
    LOG_ERR("exportRoomKeysAsJson failed", e);
    return;
  }

  let allKeys: SessionKeyJson[];
  try {
    allKeys = JSON.parse(allKeysJson) as SessionKeyJson[];
  } catch (e) {
    LOG_ERR("parse exported keys failed", e);
    return;
  }

  const match = allKeys.find(
    (k) => k.session_id === session_id && k.room_id === room_id,
  );
  if (!match) {
    LOG("no local session matched", session_id, "in room", room_id);
    return;
  }

  const payload = {
    request_id,
    keys: JSON.stringify([match]),
  };

  try {
    await client.encryptAndSendToDevice(
      RESPONSE_EVENT_TYPE,
      [{ userId: requesterUserId, deviceId: requester_device_id }],
      payload,
    );
    LOG(
      "sent",
      RESPONSE_EVENT_TYPE,
      "for session",
      session_id,
      "to",
      requesterUserId,
      requester_device_id,
    );
  } catch (e) {
    LOG_ERR("encryptAndSendToDevice failed", e);
  }
}

async function handleResponse(
  client: MatrixClient,
  event: MatrixEvent,
): Promise<void> {
  // Encrypted to-device events arrive with a sender (verified via Olm).
  // We accept responses from any user — we only act if we have a pending
  // request matching the request_id we generated.
  const content = event.getContent() as {
    request_id?: string;
    keys?: string;
  };
  const { request_id, keys } = content;
  if (!request_id || !keys) return;

  const store = getStore();
  const pending = store.pendingRequests.get(request_id);
  if (!pending) {
    LOG("response for unknown request_id", request_id);
    return;
  }
  clearTimeout(pending.timeout);
  store.pendingRequests.delete(request_id);

  const { sessionId } = pending;
  setState(sessionId, { kind: "received", receivedAt: Date.now() });

  const crypto_ = client.getCrypto();
  if (!crypto_) {
    setState(sessionId, {
      kind: "error",
      message: "Crypto not initialized.",
    });
    return;
  }

  try {
    await crypto_.importRoomKeysAsJson(keys);
    setState(sessionId, { kind: "imported", importedAt: Date.now() });
    LOG("imported keys for session", sessionId);

    let roomId: string | undefined;
    try {
      const parsed = JSON.parse(keys) as SessionKeyJson[];
      roomId = parsed[0]?.room_id;
    } catch {
      /* ignore parse errors — keys still imported above */
    }
    if (roomId) {
      const room = client.getRoom(roomId);
      if (room) await room.decryptAllEvents().catch(() => {});
    } else {
      await Promise.all(
        client
          .getRooms()
          .map((r) => r.decryptAllEvents().catch(() => {})),
      );
    }
  } catch (e) {
    LOG_ERR("importRoomKeysAsJson failed", e);
    setState(sessionId, {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

const TO_DEVICE_EVENT = "toDeviceEvent";

export function startPeerKeyShare(client: MatrixClient): () => void {
  const onToDevice = (event: MatrixEvent) => {
    const type = event.getType();
    if (type === REQUEST_EVENT_TYPE) {
      void handleRequest(client, event);
    } else if (type === RESPONSE_EVENT_TYPE) {
      void handleResponse(client, event);
    }
  };

  client.on(TO_DEVICE_EVENT as Parameters<MatrixClient["on"]>[0], onToDevice);
  LOG("listener attached");

  return () => {
    client.off(
      TO_DEVICE_EVENT as Parameters<MatrixClient["off"]>[0],
      onToDevice,
    );
    const store = getStore();
    for (const [, p] of store.pendingRequests) clearTimeout(p.timeout);
    store.pendingRequests.clear();
    store.stateBySession.clear();
    store.listenersBySession.clear();
    store.lastRequestedAt.clear();
    LOG("listener detached");
  };
}
