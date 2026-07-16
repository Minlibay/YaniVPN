import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateApiToken } from "@/lib/wg";
import { provisionServer } from "@/lib/provision";
import { panelUrlFrom, sshSchema } from "@/lib/sshInput";
import { DEFAULT_REALITY_SNI, PROTOCOLS, generateShortId } from "@/lib/vless";

const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  country: z.string().length(2),
  city: z.string().max(100).default(""),
  protocol: z.enum(PROTOCOLS).default("wireguard"),
  // домен маскировки для VLESS+Reality
  sni: z.string().max(255).optional(),
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
  const { ssh, port, protocol, sni, ...data } = parsed.data;
  if (!ssh.password && !ssh.privateKey) {
    return NextResponse.json({ error: "Укажите SSH-пароль или приватный ключ" }, { status: 400 });
  }

  // Порт по умолчанию: VLESS маскируется под HTTPS → 443, WireGuard → 51820.
  const effectivePort = port ?? (protocol === "vless" ? 443 : 51820);
  const shortId = protocol === "vless" ? generateShortId() : "";
  const realitySni = protocol === "vless" ? sni?.trim() || DEFAULT_REALITY_SNI : "";

  const server = await prisma.server.create({
    data: {
      ...data,
      country: data.country.toUpperCase(),
      port: effectivePort,
      protocol,
      realityShortId: shortId,
      realitySni,
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
      shortId,
      sni: realitySni,
    }
  );

  return NextResponse.json({ id: server.id, status: "installing" }, { status: 201 });
}
