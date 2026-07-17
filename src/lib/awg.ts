import { randomInt } from "crypto";

// AmneziaWG — форк WireGuard с обфускацией трафика. Поверх обычного WG он:
//   • шлёт Jc «мусорных» пакетов случайного размера (Jmin..Jmax) перед
//     рукопожатием — размывает узнаваемый паттерн старта соединения;
//   • добавляет случайные префиксы к init/response-пакетам (S1, S2);
//   • подменяет магические типы сообщений WG (H1..H4) на случайные значения,
//     чтобы DPI не опознавал WireGuard по фиксированным байтам заголовка.
//
// Это и есть слой «shaping» на уровне пакетов (п. 5): размеры и заголовки
// перестают быть статической сигнатурой. Параметры ОБЯЗАНЫ совпадать на
// сервере и клиенте, поэтому генерируются один раз в панели и хранятся в БД.
//
// Полное статистическое морфирование под конкретное приложение (против
// ML-классификаторов) выходит за рамки — здесь мы ломаем сигнатурный DPI.

export type AwgParams = {
  jc: number; // кол-во junk-пакетов (Junk packet count)
  jmin: number; // мин. размер junk-пакета
  jmax: number; // макс. размер junk-пакета
  s1: number; // размер junk-префикса init-пакета
  s2: number; // размер junk-префикса response-пакета
  h1: number; // подменённые магические заголовки (init)
  h2: number; // (response)
  h3: number; // (cookie)
  h4: number; // (transport)
};

// Четыре различных значения заголовков, не совпадающих с реальными типами
// сообщений WireGuard (1..4). Диапазон — весь uint32 выше 4.
function distinctHeaders(): [number, number, number, number] {
  const set = new Set<number>();
  while (set.size < 4) {
    // 5 .. 2^31-1 — с запасом, но в пределах знакового int для БД/JSON.
    set.add(randomInt(5, 2_147_483_647));
  }
  return Array.from(set) as [number, number, number, number];
}

// Генерирует случайный, но валидный набор параметров обфускации.
export function generateAwgParams(): AwgParams {
  const [h1, h2, h3, h4] = distinctHeaders();
  // S1, S2 — разные (правило AmneziaWG: S1 + 56 != S2).
  let s1 = randomInt(15, 150);
  let s2 = randomInt(15, 150);
  while (s1 + 56 === s2) s2 = randomInt(15, 150);
  return {
    jc: randomInt(4, 9), // 4..8 junk-пакетов
    jmin: 40,
    jmax: 70,
    s1,
    s2,
    h1,
    h2,
    h3,
    h4,
  };
}

export function serializeAwgParams(p: AwgParams): string {
  return JSON.stringify(p);
}

export function parseAwgParams(raw: string): AwgParams | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as AwgParams;
    if (typeof p.jc !== "number" || typeof p.h1 !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

// Строки [Interface] с параметрами обфускации — общие для конфига сервера и
// клиента (значения должны быть идентичны).
export function awgInterfaceLines(p: AwgParams): string[] {
  return [
    `Jc = ${p.jc}`,
    `Jmin = ${p.jmin}`,
    `Jmax = ${p.jmax}`,
    `S1 = ${p.s1}`,
    `S2 = ${p.s2}`,
    `H1 = ${p.h1}`,
    `H2 = ${p.h2}`,
    `H3 = ${p.h3}`,
    `H4 = ${p.h4}`,
  ];
}

// Клиентский конфиг AmneziaWG: обычный WG + блок обфускации. Импортируется в
// приложение AmneziaWG (совместимый .conf).
export function buildAmneziaClientConfig(opts: {
  clientPrivateKey: string;
  clientAddress: string;
  serverPublicKey: string;
  serverHost: string;
  serverPort: number;
  params: AwgParams;
}): string {
  return [
    "[Interface]",
    `PrivateKey = ${opts.clientPrivateKey}`,
    `Address = ${opts.clientAddress}`,
    // Приватный резолвер на ноде (unbound), запросы через туннель.
    "DNS = 10.8.0.1",
    ...awgInterfaceLines(opts.params),
    "",
    "[Peer]",
    `PublicKey = ${opts.serverPublicKey}`,
    `Endpoint = ${opts.serverHost}:${opts.serverPort}`,
    "AllowedIPs = 0.0.0.0/0, ::/0",
    "PersistentKeepalive = 25",
    "",
  ].join("\n");
}
