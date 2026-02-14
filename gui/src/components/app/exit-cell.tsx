"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import type { CustomCellRendererProps } from "ag-grid-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAppDispatch } from "@/lib/hooks";
import { cancelAndPlaceExitOrder, cancelOrder } from "@/lib/features/etradeSlice";
import type { ExitOrderBody } from "@/lib/features/etradeSlice";
import type { Position } from "@/lib/features/etradeSlice";
import type { DisplayRow } from "@/lib/strategies";

const PROFIT_PCTS = [30, 40, 50, 60];

function computeLimitPrice(
  totalCost: number,
  quantity: number,
  profitPct: number,
): number {
  const mult = 100; // always options
  const absCost = Math.abs(totalCost);
  const exitValue =
    totalCost >= 0
      ? absCost * (1 + profitPct / 100) // debit: sell higher
      : absCost * (1 - profitPct / 100); // credit: buy back cheaper
  const raw = exitValue / (Math.abs(quantity) * mult);
  // Options must be priced in $0.05 increments
  return Math.round(raw * 20) / 20;
}

function formatExpiryDate(
  year: number | null,
  month: number | null,
  day: number | null,
): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function buildSingleLegBody(leg: Position, limitPrice: number): ExitOrderBody {
  const orderAction = leg.quantity > 0 ? "SELL_CLOSE" : "BUY_CLOSE";
  return {
    symbol: leg.baseSymbol,
    securityType: "OPTN",
    orderAction,
    quantity: Math.abs(leg.quantity),
    limitPrice,
    expiryDate: formatExpiryDate(leg.expiryYear, leg.expiryMonth, leg.expiryDay),
    callPut: leg.callPut ?? undefined,
    strikePrice: leg.strikePrice ?? undefined,
  };
}

function buildSpreadBody(
  legs: Position[],
  limitPrice: number,
  totalCost: number,
): ExitOrderBody {
  // Debit position (totalCost > 0) → selling to close → NET_CREDIT
  // Credit position (totalCost < 0) → buying to close → NET_DEBIT
  const priceType = totalCost >= 0 ? "NET_CREDIT" : "NET_DEBIT";
  return {
    limitPrice,
    priceType,
    legs: legs.map((leg) => ({
      symbol: leg.baseSymbol,
      orderAction: leg.quantity > 0 ? "SELL_CLOSE" : "BUY_CLOSE",
      quantity: Math.abs(leg.quantity),
      expiryDate: formatExpiryDate(leg.expiryYear, leg.expiryMonth, leg.expiryDay),
      callPut: leg.callPut!,
      strikePrice: leg.strikePrice!,
    })),
  };
}

interface GridContext {
  sessionId: string;
  accountKey: string;
}

export function ExitCell(props: CustomCellRendererProps<DisplayRow>) {
  const row = props.data;
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const context = props.context as GridContext | undefined;

  if (!row || !context) return null;

  const legs = row._legs;
  const isOption = legs && legs.length > 0 && legs.every((l) => l.type === "OPTN");
  if (!isOption) return row.exitLabel ? <span className="text-xs tabular-nums">{row.exitLabel}</span> : null;

  const handleCancel = async () => {
    if (!row.exitOrderId || !context.sessionId || !context.accountKey) return;
    setLoading(true);
    try {
      await dispatch(
        cancelOrder({
          sessionId: context.sessionId,
          accountKey: context.accountKey,
          orderId: row.exitOrderId,
        }),
      ).unwrap();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (profitPct: number) => {
    if (!legs || !context.sessionId || !context.accountKey) return;

    const limitPrice = computeLimitPrice(row.totalCost, row.quantity, profitPct);

    const body: ExitOrderBody =
      legs.length === 1
        ? buildSingleLegBody(legs[0], limitPrice)
        : buildSpreadBody(legs, limitPrice, row.totalCost);

    setLoading(true);
    try {
      await dispatch(
        cancelAndPlaceExitOrder({
          sessionId: context.sessionId,
          accountKey: context.accountKey,
          existingOrderId: row.exitOrderId ?? null,
          body,
        }),
      ).unwrap();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1 h-full w-full">
      {row.exitLabel && (
        <span className="text-xs tabular-nums">{row.exitLabel}</span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={loading}>
          <button className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-accent">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {row.exitOrderId != null && (
            <>
              <DropdownMenuItem onSelect={handleCancel} className="text-red-600 dark:text-red-400">
                Cancel order
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {PROFIT_PCTS.map((pct) => {
            const price = computeLimitPrice(row.totalCost, row.quantity, pct);
            return (
              <DropdownMenuItem
                key={pct}
                onSelect={() => handleSelect(pct)}
              >
                Exit at {pct}% profit (${price.toFixed(2)})
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
