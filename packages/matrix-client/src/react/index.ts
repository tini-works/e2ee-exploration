"use client";

import { MatrixProvider, useMatrix } from "./provider";
import {
  markKeyUnlocked,
  resetBackup,
  signIn,
  signOut,
} from "../state/actions";

/**
 * Cross-cutting React surface: provider + the one useMatrix() that exposes
 * session/client/status, plus the action thunks (signIn/signOut/etc.).
 *
 * Feature-specific hooks (patient invites, device verification, peer key share)
 * live in their own feature namespaces — `matrixPatient.useInvites`,
 * `matrixCrypto.useDeviceVerification`, `matrixCrypto.usePeerKeyShareState`.
 */
export const matrixReact = {
  Provider: MatrixProvider,
  useMatrix,
  signIn,
  signOut,
  resetBackup,
  markKeyUnlocked,
} as const;

/**
 * Direct export of the provider component.
 *
 * Reach for this (instead of `matrixReact.Provider`) when mounting from a
 * Server Component — e.g. the root layout. Across the RSC boundary a client
 * module's exports arrive as client-reference proxies, so reading a nested
 * property like `matrixReact.Provider` yields `undefined`. A component used as
 * an element from the server must be a direct export.
 */
export { MatrixProvider } from "./provider";

export type {
  CryptoStatus,
  MatrixContextValue,
  MatrixProviderProps,
  NotReadyReason,
} from "./provider";
