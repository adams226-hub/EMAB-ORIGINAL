"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { CHART_CATEGORICAL, CHART_CHROME } from "./chart-colors";
import { formatChartValue, type ChartValueFormat } from "./format-value";

export interface TrendSeries {
  key: string;
  label: string;
}

export function TrendChart<T extends object>({
  data,
  xKey,
  series,
  format = "number",
  height = 300,
}: {
  data: T[];
  xKey: string;
  series: TrendSeries[];
  format?: ChartValueFormat;
  height?: number;
}) {
  const fmt = (v: number) => formatChartValue(v, format);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART_CHROME.gridline} />
        <XAxis
          dataKey={xKey}
          stroke={CHART_CHROME.axis}
          tick={{ fill: CHART_CHROME.mutedText, fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          stroke={CHART_CHROME.axis}
          tick={{ fill: CHART_CHROME.mutedText, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => fmt(Number(v))}
          width={70}
        />
        <Tooltip
          formatter={(value, name) => [fmt(Number(value)), String(name)]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e1e0d9",
            boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.08)",
            fontSize: 13,
          }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={CHART_CATEGORICAL[i % CHART_CATEGORICAL.length]}
            strokeWidth={2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
