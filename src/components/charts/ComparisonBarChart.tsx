"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { CHART_CATEGORICAL, CHART_CHROME } from "./chart-colors";
import { formatChartValue, type ChartValueFormat } from "./format-value";

export interface BarSeries {
  key: string;
  label: string;
}

export function ComparisonBarChart<T extends object>({
  data,
  categoryKey,
  series,
  layout = "vertical",
  format = "number",
  height = 300,
}: {
  data: T[];
  categoryKey: string;
  series: BarSeries[];
  /** "vertical" = barres horizontales (labels longs) ; "horizontal" = barres verticales */
  layout?: "vertical" | "horizontal";
  format?: ChartValueFormat;
  height?: number;
}) {
  const fmt = (v: number) => formatChartValue(v, format);
  const isHorizontalBars = layout === "vertical";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        barCategoryGap={isHorizontalBars ? 10 : 16}
      >
        <CartesianGrid horizontal={!isHorizontalBars} vertical={isHorizontalBars} stroke={CHART_CHROME.gridline} />
        {isHorizontalBars ? (
          <>
            <XAxis
              type="number"
              stroke={CHART_CHROME.axis}
              tick={{ fill: CHART_CHROME.mutedText, fontSize: 12 }}
              tickLine={false}
              tickFormatter={(v) => fmt(Number(v))}
            />
            <YAxis
              type="category"
              dataKey={categoryKey}
              stroke={CHART_CHROME.axis}
              tick={{ fill: CHART_CHROME.mutedText, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={110}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={categoryKey}
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
          </>
        )}
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
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={CHART_CATEGORICAL[i % CHART_CATEGORICAL.length]}
            radius={isHorizontalBars ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={28}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
