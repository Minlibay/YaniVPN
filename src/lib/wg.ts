import { generateKeyPairSync, randomBytes } from "crypto";

// Ключи WireGuard — это пары Curve25519 (x25519) в base64.
// Node умеет генерировать их нативно, поэтому панель может
// выпускать клиентские ключи без внешних утилит.
export function generateWgKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync("x25519");

  // Экспортируем в DER и берём последние 32 байта — сырой ключ.
  const rawPriv = privateKey.export({ type: "pkcs8", format: "der" }).subarray(-32);
  const rawPub = publicKey.export({ type: "spki", format: "der" }).subarray(-32);

  return {
    privateKey: Buffer.from(rawPriv).toString("base64"),
    publicKey: Buffer.from(rawPub).toString("base64"),
  };
}

export function generateApiToken(): string {
  return randomBytes(32).toString("hex");
}

// Выбирает первый свободный адрес в 10.8.0.0/24 среди занятых пиров сервера.
export function nextClientIp(usedIps: string[]): string {
  const used = new Set(usedIps.map((ip) => ip.split("/")[0]));
  for (let i = 2; i < 255; i++) {
    const candidate = `10.8.0.${i}`;
    if (!used.has(candidate)) return `${candidate}/32`;
  }
  throw new Error("Свободные адреса в подсети 10.8.0.0/24 закончились");
}

export function buildClientConfig(opts: {
  clientPrivateKey: string;
  clientAddress: string;
  serverPublicKey: string;
  serverHost: string;
  serverPort: number;
}): string {
  return [
    "[Interface]",
    `PrivateKey = ${opts.clientPrivateKey}`,
    `Address = ${opts.clientAddress}`,
    "DNS = 1.1.1.1, 8.8.8.8",
    "",
    "[Peer]",
    `PublicKey = ${opts.serverPublicKey}`,
    `Endpoint = ${opts.serverHost}:${opts.serverPort}`,
    "AllowedIPs = 0.0.0.0/0, ::/0",
    "PersistentKeepalive = 25",
    "",
  ].join("\n");
}
