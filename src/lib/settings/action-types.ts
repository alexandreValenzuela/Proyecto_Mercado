export type SettingsActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string>;
};

export const initialSettingsActionState: SettingsActionState = {
  ok: false,
  message: null,
  fieldErrors: {},
};

export function settingsActionError(
  message: string,
  fieldErrors: Record<string, string> = {},
): SettingsActionState {
  return { ok: false, message, fieldErrors };
}

export function settingsActionSuccess(message: string): SettingsActionState {
  return { ok: true, message, fieldErrors: {} };
}
