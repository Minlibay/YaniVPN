import { z } from "zod";
import type { NextRequest } from "next/server";

export const sshSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(22),
  username: z.string().min(1).max(64).default("root"),
  password: z.string().max(500).optional(),
  privateKey: z.string().max(20000).optional(),
});

// Адрес, по которому ноды будут слать статистику: явный PANEL_URL
// из окружения или origin текущего запроса (подходит для dev).
export function panelUrlFrom(req: NextRequest): string {
  return process.env.PANEL_URL ?? new URL(req.url).origin;
}
