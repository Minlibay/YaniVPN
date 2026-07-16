import { randomUUID, randomBytes } from "crypto";

// Протоколы, которые панель умеет разворачивать на нодах.
export const PROTOCOLS = ["wireguard", "vless"] as const;
export type Protocol = (typeof PROTOCOLS)[number];

export const PROTOCOL_LABELS: Record<Protocol, string> = {
  wireguard: "WireGuard",
  vless: "VLESS + Reality (обход блокировок)",
};

export function isProtocol(v: string): v is Protocol {
  return (PROTOCOLS as readonly string[]).includes(v);
}

// Домен маскировки по умолчанию: под него Reality «притворяется» при
// TLS-хендшейке, поэтому цель должна быть популярным HTTPS-сайтом с TLS 1.3.
export const DEFAULT_REALITY_SNI = "www.microsoft.com";

export function generateClientUuid(): string {
  return randomUUID();
}

// Reality short id — от 1 до 8 байт в hex. Берём 8 (16 hex-символов).
export function generateShortId(): string {
  return randomBytes(8).toString("hex");
}

// Собирает ссылку vless://…#name для импорта в v2rayNG / v2rayN / Shadowrocket / streisand.
// Reality: security=reality, flow=xtls-rprx-vision, публичный ключ и short id — от сервера.
export function buildVlessLink(opts: {
  uuid: string;
  host: string;
  port: number;
  publicKey: string; // Reality public key сервера
  shortId: string;
  sni: string;
  name: string;
}): string {
  const params = new URLSearchParams({
    type: "tcp",
    security: "reality",
    encryption: "none",
    flow: "xtls-rprx-vision",
    sni: opts.sni,
    fp: "chrome", // fingerprint TLS-клиента
    pbk: opts.publicKey,
    sid: opts.shortId,
  });
  return `vless://${opts.uuid}@${opts.host}:${opts.port}?${params.toString()}#${encodeURIComponent(
    opts.name
  )}`;
}
