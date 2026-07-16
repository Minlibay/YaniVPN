export function formatBytes(bytes: number | bigint): string {
  let n = Number(bytes);
  if (!isFinite(n) || n < 0) n = 0;
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ", "ПБ"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: n >= 100 ? 0 : 1 })} ${units[i]}`;
}

export function formatRelative(date: Date | null): string {
  if (!date) return "никогда";
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "только что";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
}

// Сервер считается онлайн, если агент отчитывался за последние 3 минуты.
export const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

export function isOnline(lastSeenAt: Date | null): boolean {
  return !!lastSeenAt && Date.now() - lastSeenAt.getTime() < ONLINE_THRESHOLD_MS;
}

// Флаг страны из ISO-кода ("NL" → 🇳🇱)
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}
