"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chart, timeLabel } from "./chartTheme";

type Point = { t: number; conns: number };

export function ConnectionsChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">Пока нет данных</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
          allowDecimals={false}
          tick={{ fill: chart.axis, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          labelFormatter={(t) => timeLabel(Number(t))}
          formatter={(value) => [String(value), "Подключений"]}
          contentStyle={{
            background: chart.tooltipBg,
            border: `1px solid ${chart.tooltipBorder}`,
            borderRadius: 8,
            fontSize: 12,
          }}
          itemStyle={{ color: "#e2e8f0" }}
          labelStyle={{ color: chart.axis }}
        />
        <Line
          type="monotone"
          dataKey="conns"
          stroke={chart.series1}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
