export type CatalogActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  redirectTo?: string;
};

export const initialCatalogActionState: CatalogActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};

export function catalogActionError(
  message: string,
  fieldErrors: Record<string, string> = {},
): CatalogActionState {
  return { status: "error", message, fieldErrors };
}

export function catalogActionSuccess(message: string, redirectTo?: string): CatalogActionState {
  return { status: "success", message, fieldErrors: {}, redirectTo };
}
