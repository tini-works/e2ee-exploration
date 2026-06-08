import type { ScopedValueRegistry } from "pumped-devtools";
import { signInForm } from "@/features/auth/sign-in";
import {
  newPatientForm,
  editPatientForm,
} from "@/features/patient/patient-form";
import { composerForm } from "@/features/patient/message-timeline";
import {
  recoveryKeyForm,
  resetBackupForm,
} from "@/features/clinic/recovery-key-provider";

/**
 * label -> scopedValue map for every pumped-fn form in the app, watched by the
 * dev-only PumpedDevtools "Forms" tab. Labels mirror each scopedValue's `name`.
 */
export const formScopedValues: ScopedValueRegistry = {
  "sign-in": signInForm,
  "new-patient": newPatientForm,
  "edit-patient": editPatientForm,
  "message-composer": composerForm,
  "recovery-key": recoveryKeyForm,
  "reset-backup": resetBackupForm,
};
