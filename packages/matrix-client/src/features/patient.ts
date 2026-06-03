"use client";

import {
  PATIENT_TAG,
  PATIENT_RECORD_EVENT_TYPE,
  PROFILE_THREAD_STATE_TYPE,
  fullName,
  getProfileThreadRoot,
  listPatients,
  createPatient,
  updatePatient,
  listPatientHistory,
  deletePatient,
  getPatient,
} from "./patient.records";
import {
  listPendingInvites,
  acceptPatientInvite,
  declinePatientInvite,
} from "./patient.invites";
import { usePatientInvites } from "./patient.hooks";

/**
 * Patient feature surface for matrix-client. Exported as a single object so the
 * host project can call `matrixPatient.get(...)` etc. without colliding with its
 * own domain code (which is likely to have its own `Patient`, `getPatient`, …).
 *
 * Method names are intentionally short here — the `matrixPatient.` prefix is
 * what does the disambiguation work.
 */
export const matrixPatient = {
  // event-type identifiers — exposed for diagnostics and tests
  TAG: PATIENT_TAG,
  RECORD_EVENT_TYPE: PATIENT_RECORD_EVENT_TYPE,
  PROFILE_THREAD_STATE_TYPE,
  // records
  fullName,
  list: listPatients,
  get: getPatient,
  create: createPatient,
  update: updatePatient,
  remove: deletePatient,
  listHistory: listPatientHistory,
  getProfileThreadRoot,
  // invites
  listPendingInvites,
  acceptInvite: acceptPatientInvite,
  declineInvite: declinePatientInvite,
  // hooks
  useInvites: usePatientInvites,
} as const;

export type {
  MatrixPatient,
  MatrixPatientRecord,
  MatrixPatientRecordRevision,
  MatrixPendingInvite,
} from "../types/patient";
