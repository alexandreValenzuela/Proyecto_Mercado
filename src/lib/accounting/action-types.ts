export type AccountingActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
};

export const initialAccountingActionState: AccountingActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};

export function accountingActionError(
  message: string,
  fieldErrors: Record<string, string> = {},
): AccountingActionState {
  return { status: "error", message, fieldErrors };
}

export function accountingActionSuccess(message: string): AccountingActionState {
  return { status: "success", message, fieldErrors: {} };
}
