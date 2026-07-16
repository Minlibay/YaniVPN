import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "yanivpn_session";

// Всё, кроме логина, API агентов и API приложения, требует сессии администратора.
// /api/app/* авторизуется собственным кодом аккаунта (Bearer), не admin-сессией.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/agent", "/api/app"];

// CORS для API приложения: мобильный клиент и Flutter web обращаются
// с другого origin. Авторизация — Bearer-токен (не cookie), поэтому "*" безопасен.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/app")) {
    // Preflight-запрос браузера
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    return res;
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      return NextResponse.next();
    } catch {
      // просроченный или битый токен — на логин
    }
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Пропускаем статику Next.js и favicon
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
