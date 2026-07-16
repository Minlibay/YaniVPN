import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { accountFromRequest } from "@/lib/account";
import { isOnline } from "@/lib/format";

// Список доступных серверов для приложения (только публичные поля).
export async function GET(req: NextRequest) {
  const account = await accountFromRequest(req);
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const servers = await prisma.server.findMany({
    where: { status: "active" },
    orderBy: [{ country: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      country: true,
      city: true,
      protocol: true,
      lastSeenAt: true,
    },
  });

  return NextResponse.json({
    servers: servers.map((s) => ({
      id: s.id,
      name: s.name,
      country: s.country,
      city: s.city,
      protocol: s.protocol,
      online: isOnline(s.lastSeenAt),
    })),
  });
}
