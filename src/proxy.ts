import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

/**
 * Guardián de request en el edge (Next.js 16 reemplazó `middleware.ts` por
 * `proxy.ts`). Es solo una primera barrera: los server actions, route handlers
 * y queries del admin deben verificar el rol con `requireAdmin()`.
 */
const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const session = request.auth;
  const { pathname, search, origin } = request.nextUrl;
  const isProtected = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAccount = pathname === "/cuenta" || pathname.startsWith("/cuenta/");

  if (!isProtected && !isAccount) {
    return;
  }

  if (!session?.user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtected && session.user.role !== "admin") {
    return NextResponse.redirect(new URL("/403", origin));
  }
});

export const config = {
  matcher: ["/admin/:path*", "/cuenta/:path*"],
};
