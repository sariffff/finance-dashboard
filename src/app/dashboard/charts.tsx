"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Values arrive as integer satang from the server and are only turned into
// baht numbers here, for drawing. Totals shown as text are formatted
// server-side from exact satang.

const bahtFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});
const compactFormatter = new Intl.NumberFormat("th-TH", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatBaht = (baht: number) => bahtFormatter.format(baht);

export type CategoryDatum = { name: string; satang: number; count: number };

const categoryConfig = {
  baht: { label: "รายจ่าย", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * Spending per category as horizontal bars, largest first. One series, so
 * one color and no legend; each bar carries its value as a direct label.
 */
export function CategorySpendingChart({ data }: { data: CategoryDatum[] }) {
  const rows = data.map((d) => ({ name: d.name, baht: d.satang / 100, count: d.count }));

  return (
    <ChartContainer
      config={categoryConfig}
      className="aspect-auto w-full"
      style={{ height: rows.length * 36 + 8 }}
    >
      <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 72, top: 0, bottom: 0 }} barCategoryGap={2}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={128}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value, _name, item) => (
                <div className="grid gap-0.5">
                  <span className="font-medium tabular-nums">{formatBaht(Number(value))}</span>
                  <span className="text-muted-foreground">{item.payload.count} รายการ</span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="baht" fill="var(--color-baht)" radius={[0, 4, 4, 0]} maxBarSize={24}>
          <LabelList
            dataKey="baht"
            position="right"
            offset={8}
            className="fill-foreground"
            fontSize={12}
            formatter={(value) => formatBaht(Number(value))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export type MonthDatum = { month: string; label: string; inSatang: number; outSatang: number };

// Series slots 1 and 2 of the validated palette, in fixed order.
const trendConfig = {
  expense: { label: "รายจ่าย", color: "var(--chart-1)" },
  income: { label: "รายรับ", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Monthly income vs spending: two series on one shared baht axis. */
export function MonthlyTrendChart({ data }: { data: MonthDatum[] }) {
  const rows = data.map((d) => ({
    label: d.label,
    expense: d.outSatang / 100,
    income: d.inSatang / 100,
  }));

  return (
    <ChartContainer config={trendConfig} className="aspect-auto h-64 w-full">
      <BarChart data={rows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} strokeOpacity={0.4} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <YAxis
          width={48}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickFormatter={(value: number) => compactFormatter.format(value)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {trendConfig[name as keyof typeof trendConfig]?.label}
                  </span>
                  <span className="font-medium tabular-nums">{formatBaht(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  );
}
