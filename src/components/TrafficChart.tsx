"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBytes } from "@/lib/format";
import { chart, timeLabel } from "./chartTheme";

type Point = { t: number; rx: number; tx: number };

export function TrafficChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">Пока нет данных</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={chart.grid} strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={timeLabel}
          tick={{ fill: chart.axis, fontSize: 12 }}
          axisLine={{ stroke: chart.grid }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          tickFormatter={(v: number) => formatBytes(v)}
          tick={{ fill: chart.axis, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          labelFormatter={(t) => timeLabel(Number(t))}
          formatter={(value, name) => [
            formatBytes(Number(value)),
            name === "tx" ? "Отправлено клиентам" : "Получено от клиентов",
          ]}
          contentStyle={{
            background: chart.tooltipBg,
            border: `1px solid ${chart.tooltipBorder}`,
            borderRadius: 8,
            fontSize: 12,
          }}
          itemStyle={{ color: "#e2e8f0" }}
          labelStyle={{ color: chart.axis }}
        />
        <Legend
          formatter={(v: string) =>
            v === "tx" ? "Отправлено клиентам" : "Получено от клиентов"
          }
          wrapperStyle={{ fontSize: 12, color: "#c3c2b7" }}
        />
        <Area
          type="monotone"
          dataKey="tx"
          stroke={chart.series1}
          strokeWidth={2}
          fill={chart.series1}
          fillOpacity={0.12}
        />
        <Area
          type="monotone"
          dataKey="rx"
          stroke={chart.series2}
          strokeWidth={2}
          fill={chart.series2}
          fillOpacity={0.12}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
