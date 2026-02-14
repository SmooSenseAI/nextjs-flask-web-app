import type { CustomCellRendererProps } from "ag-grid-react";
import type { DisplayRow } from "@/lib/strategies";

interface PlCellParams {
  pctField: keyof DisplayRow;
}

function formatRoundedCurrency(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export function PlCell(
  props: CustomCellRendererProps<DisplayRow> & PlCellParams,
) {
  const data = props.data;
  if (!data) return null;

  const value = props.value as number | null;
  if (value == null) return null;

  const pct = data[props.pctField] as number | null;
  const absPct = Math.min(Math.abs(pct ?? 0), 100);
  const isGain = value > 0;
  const isLoss = value < 0;

  const barColor = isGain
    ? "bg-green-500"
    : isLoss
      ? "bg-red-500"
      : "bg-muted";

  return (
    <div className="flex flex-col justify-center h-full py-1">
      <span
        className={`text-right text-xs tabular-nums ${
          isGain
            ? "text-green-600 dark:text-green-400"
            : isLoss
              ? "text-red-600 dark:text-red-400"
              : ""
        }`}
      >
        {formatRoundedCurrency(value)}
      </span>
      <div className="flex h-[3px] mt-0.5 rounded-full overflow-hidden">
        <div className={barColor} style={{ width: `${absPct}%` }} />
        <div className="bg-muted flex-1" />
      </div>
    </div>
  );
}
