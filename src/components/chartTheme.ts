// Цвета графиков: категориальные слоты валидированы скриптом dataviz
// (CVD ΔE 27.3, контраст ≥3:1 на поверхности #111a2e).
export const chart = {
  series1: "#3987e5", // синий
  series2: "#008300", // зелёный
  grid: "#1e2a44",
  axis: "#898781",
  tooltipBg: "#111a2e",
  tooltipBorder: "#1e2a44",
};

export function timeLabel(t: number): string {
  return new Date(t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
