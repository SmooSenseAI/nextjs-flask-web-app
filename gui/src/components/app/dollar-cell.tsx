import type { CustomCellRendererProps } from "ag-grid-react";

export function formatDollar(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(1)}k`;
  }
  return `${sign}$${Math.round(abs)}`;
}

export function DollarCell(props: CustomCellRendererProps) {
  const value = props.value as number | null;
  if (value == null) return null;
  let formatted = formatDollar(value);
  const isZero = formatted === "$0" || formatted === "-$0";
  if (isZero) formatted = "$0";
  const color = isZero
    ? ""
    : value > 0
      ? "text-green-600 dark:text-green-400"
      : value < 0
        ? "text-red-600 dark:text-red-400"
        : "";
  return <div className={`text-right w-full ${color}`}>{formatted}</div>;
}
