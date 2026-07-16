import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { provisionServer } from "@/lib/provision";
import { panelUrlFrom, sshSchema } from "@/lib/sshInput";

type Params = { params: { id: string } };

// Повторный запуск установки (после ошибки или для переустановки агента).
export async function POST(req: NextRequest, { params }: Params) {
  const server = await prisma.server.findUnique({ where: { id: params.id } });
  if (!server) {
    return NextResponse.json({ error: "Сервер не найден" }, { status: 404 });
  }
  if (server.status === "installing") {
    return NextResponse.json({ error: "Установка уже идёт" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = sshSchema.safeParse(body?.ssh ?? {});
  if (!parsed.success || (!parsed.data.password && !parsed.data.privateKey)) {
    return NextResponse.json(
      { error: "Укажите SSH-пароль или приватный ключ" },
      { status: 400 }
    );
  }

  await prisma.server.update({
    where: { id: server.id },
    data: { status: "installing", provisionError: null },
  });

  void provisionServer(
    server.id,
    { host: server.host, ...parsed.data },
    server.port,
    panelUrlFrom(req),
    server.apiToken
  );

  return NextResponse.json({ ok: true, status: "installing" });
}
