import { randomUUID, randomBytes, randomInt } from "crypto";

// Протоколы, которые панель умеет разворачивать на нодах.
//   wireguard — классический WireGuard (быстрый, но легко детектируется DPI).
//   awg       — AmneziaWG: WireGuard с обфускацией (junk-пакеты + случайные
//               заголовки), устойчив к сигнатурному DPI.
//   vless     — VLESS + Reality: маскировка под настоящий HTTPS-сайт.
export const PROTOCOLS = ["wireguard", "awg", "vless"] as const;
export type Protocol = (typeof PROTOCOLS)[number];

export const PROTOCOL_LABELS: Record<Protocol, string> = {
  wireguard: "WireGuard",
  awg: "AmneziaWG (обфускация WireGuard)",
  vless: "VLESS + Reality (обход блокировок)",
};

export function isProtocol(v: string): v is Protocol {
  return (PROTOCOLS as readonly string[]).includes(v);
}

// Пул доменов маскировки для Reality. Требования к цели:
//   • популярный HTTPS-сайт с TLS 1.3 и HTTP/2 (иначе рукопожатие не совпадёт);
//   • желательно на крупном CDN, который дорого блокировать целиком;
//   • «скучно-легитимный» — массовый трафик к нему не вызывает подозрений.
// Разные ноды получают РАЗНЫЕ SNI из пула: это убирает «стадный» признак,
// когда весь трафик сервиса фронтит один и тот же домен.
export const REALITY_SNI_POOL = [
  "www.microsoft.com",
  "www.apple.com",
  "www.amazon.com",
  "dl.google.com",
  "www.cloudflare.com",
  "www.bing.com",
  "www.icloud.com",
  "aws.amazon.com",
  "www.samsung.com",
  "player.vimeo.com",
] as const;

// Домен маскировки по умолчанию (используется в подсказках UI).
export const DEFAULT_REALITY_SNI = REALITY_SNI_POOL[0];

// Возвращает случайный SNI из пула — для разнообразия между нодами.
export function pickRandomSni(): string {
  return REALITY_SNI_POOL[randomInt(REALITY_SNI_POOL.length)];
}

export function generateClientUuid(): string {
  return randomUUID();
}

// Reality short id — от 1 до 8 байт в hex. Берём 8 (16 hex-символов).
export function generateShortId(): string {
  return randomBytes(8).toString("hex");
}

// Несколько short id на ноду: клиентам раздаются РАЗНЫЕ id, что разносит их
// внутри одного сервера (нет общего для всех признака). Хранится в БД строкой
// через запятую в поле realityShortId.
export function generateShortIds(count = 4): string[] {
  return Array.from({ length: count }, () => generateShortId());
}

// Разбирает поле realityShortId (CSV) в массив. Совместимо со старым форматом
// (один id без запятых).
export function parseShortIds(field: string): string[] {
  return field
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Выбирает случайный short id сервера для конкретного клиента.
export function pickShortId(field: string): string {
  const ids = parseShortIds(field);
  if (ids.length === 0) return "";
  return ids[randomInt(ids.length)];
}

// ws-путь для CDN-режима — случайный, чтобы не угадывался.
export function generateWsPath(): string {
  return "/" + randomBytes(6).toString("hex");
}

// Ссылка VLESS+WS за Cloudflare: клиент идёт на домен по 443/TLS (CF), внутри —
// WebSocket с заданным Host/path. Голый IP ноды не участвует.
export function buildVlessWsLink(opts: {
  uuid: string;
  domain: string;
  path: string;
  name: string;
}): string {
  const params = new URLSearchParams({
    type: "ws",
    security: "tls",
    encryption: "none",
    host: opts.domain,
    sni: opts.domain,
    fp: "chrome",
    path: opts.path,
  });
  // Клиент подключается к домену по 443 (Cloudflare терминирует TLS).
  return `vless://${opts.uuid}@${opts.domain}:443?${params.toString()}#${encodeURIComponent(
    opts.name
  )}`;
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
