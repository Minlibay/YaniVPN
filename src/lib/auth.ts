import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";

const SESSION_COOKIE = "yanivpn_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 дней

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

// Secure-куки браузер не отправляет по HTTP, поэтому флаг ставим только когда
// панель реально открыта по HTTPS (напрямую или за обратным прокси). Иначе при
// деплое по голому IP (http://<ip>:3000) кука не сохранится и вход не сработает.
function isHttpsRequest(): boolean {
  const proto = headers().get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return process.env.PANEL_URL?.startsWith("https://") ?? false;
}

export type SessionPayload = {
  adminId: string;
  email: string;
  name: string;
};

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttpsRequest(),
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function destroySession() {
  cookies().delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };
