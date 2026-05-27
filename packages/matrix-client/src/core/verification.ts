"use client";

import type { MatrixClient } from "matrix-js-sdk";
import type { DeviceVerification } from "../types/crypto";

/**
 * Reads the cross-signing trust state for the current session. Returns nulls
 * when crypto isn't ready yet so callers can render a "checking…" state
 * instead of a misleading "unverified".
 */
export async function getDeviceVerification(
  client: MatrixClient,
): Promise<DeviceVerification | null> {
  const crypto = client.getCrypto();
  const userId = client.getUserId();
  const deviceId = client.getDeviceId();
  if (!crypto || !userId || !deviceId) return null;
  try {
    const [device, user] = await Promise.all([
      crypto.getDeviceVerificationStatus(userId, deviceId),
      crypto.getUserVerificationStatus(userId),
    ]);
    return {
      deviceVerified: !!device?.signedByOwner,
      userVerified: !!user?.isCrossSigningVerified(),
    };
  } catch {
    return { deviceVerified: false, userVerified: false };
  }
}
