import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateApiToken } from "@/lib/wg";
import { provisionServer } from "@/lib/provision";
import { panelUrlFrom, sshSchema } from "@/lib/sshInput";
import { PROTOCOLS, generateShortIds, pickRandomSni, generateWsPath } from "@/lib/vless";
import { generateAwgParams, serializeAwgParams } from "@/lib/awg";

const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  country: z.string().length(2),
  city: z.string().max(100).default(""),
  protocol: z.enum(PROTOCOLS).default("wireguard"),
  // домен маскировки для VLESS+Reality
  sni: z.string().max(255).optional(),
  // транспорт VLESS: reality (прямое) или ws (за Cloudflare/CDN)
  transport: z.enum(["reality", "ws"]).default("reality"),
  domain: z.string().max(255).optional(), // ws: домен за CDN
  ssh: sshSchema,
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные данные", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { ssh, port, protocol, sni, transport, domain, ...data } = parsed.data;
  if (!ssh.password && !ssh.privateKey) {
    return NextResponse.json({ error: "Укажите SSH-пароль или приватный ключ" }, { status: 400 });
  }

  const isVless = protocol === "vless";
  const isWs = isVless && transport === "ws";
  if (isWs && !domain?.trim()) {
    return NextResponse.json(
      { error: "Для VLESS за CDN укажите домен (A-запись на Cloudflare → IP ноды)" },
      { status: 400 }
    );
  }

  // Порт по умолчанию: VLESS+ws origin слушает 80 (TLS терминирует CDN),
  // VLESS+reality маскируется под HTTPS → 443, WG/AWG → 51820.
  const effectivePort = port ?? (isWs ? 80 : isVless ? 443 : 51820);
  // Несколько short id на ноду — клиентам раздаются разные (хранятся CSV).
  const shortIds = isVless ? generateShortIds() : [];
  // SNI берём из пула случайно (разнообразие между нодами), если не задан явно.
  const realitySni = isVless ? sni?.trim() || pickRandomSni() : "";
  // Параметры обфускации AmneziaWG генерируются один раз и хранятся в БД.
  const awgParams = protocol === "awg" ? generateAwgParams() : null;
  const vlessTransport = isVless ? transport : "reality";
  const vlessDomain = isWs ? domain!.trim() : "";
  const wsPath = isWs ? generateWsPath() : "";

  const server = await prisma.server.create({
    data: {
      ...data,
      country: data.country.toUpperCase(),
      port: effectivePort,
      protocol,
      realityShortId: shortIds.join(","),
      realitySni,
      vlessTransport,
      vlessDomain,
      vlessPath: wsPath,
      awgParams: awgParams ? serializeAwgParams(awgParams) : "",
      apiToken: generateApiToken(),
      status: "installing",
    },
  });

  // Установка идёт в фоне; SSH-данные живут только в этом запросе.
  void provisionServer(
    server.id,
    { host: server.host, ...ssh },
    {
      protocol,
      port: effectivePort,
      panelUrl: panelUrlFrom(req),
      apiToken: server.apiToken,
      shortIds,
      sni: realitySni,
      transport: vlessTransport,
      domain: vlessDomain,
      wsPath,
      awgParams,
    }
  );

  return NextResponse.json({ id: server.id, status: "installing" }, { status: 201 });
}
