import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { productViewSchema } from "@/lib/validators/catalog";
import { recordProductView } from "@/server/catalog/product-views";

const VISITOR_COOKIE = "visitor_token";
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = productViewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const cookieStore = await cookies();
  let visitorToken: string = cookieStore.get(VISITOR_COOKIE)?.value ?? "";
  const isNewToken = visitorToken.length < 8;
  if (isNewToken) {
    visitorToken = crypto.randomUUID();
  }

  const session = await auth();
  const result = await recordProductView({
    productId: parsed.data.productId,
    sessionToken: visitorToken,
    userId: session?.user?.id ?? null,
  });

  const response = NextResponse.json({ ok: true, recorded: result.recorded });
  if (isNewToken) {
    response.cookies.set({
      name: VISITOR_COOKIE,
      value: visitorToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: THIRTY_DAYS_SECONDS,
    });
  }

  return response;
}
