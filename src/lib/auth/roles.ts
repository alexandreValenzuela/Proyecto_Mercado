import type { userRoleEnum } from "@/db/schema";

/** Derivado del enum de la BD para no duplicar los valores permitidos. */
export type UserRole = (typeof userRoleEnum)["enumValues"][number];
