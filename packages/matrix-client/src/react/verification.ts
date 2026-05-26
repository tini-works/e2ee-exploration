"use client";

import { useEffect, useState } from "react";
import { getDeviceVerification, type DeviceVerification } from "../verification";
import { useMatrix } from "./provider";

/**
 * Subscribes to device + user cross-signing trust for the current session.
 * Re-checks whenever the SDK reports a device list refresh, a user trust
 * change, or a keys-changed event (e.g. just after unlocking with a recovery
 * key). Returns null while crypto is still initializing.
 */
export function useDeviceVerification(): DeviceVerification | null {
  const { client, cryptoStatus } = useMatrix();
  const [state, setState] = useState<DeviceVerification | null>(null);

  useEffect(() => {
    if (!client) {
      setState(null);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      const v = await getDeviceVerification(client);
      if (!cancelled) setState(v);
    };
    void refresh();
    let detach = () => {};
    void (async () => {
      const { CryptoEvent } = await import("matrix-js-sdk/lib/crypto-api");
      if (cancelled) return;
      const onChange = () => void refresh();
      client.on(CryptoEvent.DevicesUpdated, onChange);
      client.on(CryptoEvent.UserTrustStatusChanged, onChange);
      client.on(CryptoEvent.KeysChanged, onChange);
      detach = () => {
        client.off(CryptoEvent.DevicesUpdated, onChange);
        client.off(CryptoEvent.UserTrustStatusChanged, onChange);
        client.off(CryptoEvent.KeysChanged, onChange);
      };
    })();
    return () => {
      cancelled = true;
      detach();
    };
  }, [client, cryptoStatus]);

  return state;
}
