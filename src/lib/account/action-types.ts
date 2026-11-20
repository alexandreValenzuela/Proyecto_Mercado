export type ProfileActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string>;
};

export const initialProfileActionState: ProfileActionState = {
  ok: false,
  message: null,
  fieldErrors: {},
};

export function profileActionError(
  message: string,
  fieldErrors: Record<string, string> = {},
): ProfileActionState {
  return { ok: false, message, fieldErrors };
}

export function profileActionSuccess(message: string): ProfileActionState {
  return { ok: true, message, fieldErrors: {} };
}
