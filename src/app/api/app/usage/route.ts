import { NextRequest, NextResponse } from "next/server";
import { accountFromRequest, accountUsage } from "@/lib/account";

// Текущее потребление трафика и план (для индикатора «X / 2 ГБ»).
export async function GET(req: NextRequest) {
  const account = await accountFromRequest(req);
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await accountUsage(account));
}
