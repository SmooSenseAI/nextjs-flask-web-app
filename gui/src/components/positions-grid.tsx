"use client";

import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  colorSchemeDark,
  colorSchemeLight,
  themeQuartz,
  type ColDef,
  type RowClassParams,
  type ValueFormatterParams,
} from "ag-grid-community";
import { useTheme } from "@/components/theme-provider";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { AccountSummary } from "@/components/app/account-summary";
import { DollarCell } from "@/components/app/dollar-cell";
import { ExitCell } from "@/components/app/exit-cell";
import { PlCell } from "@/components/app/pl-cell";
import { type DisplayRow, groupIntoStrategies } from "@/lib/strategies";
import type { Position, Order, OrderLeg, AccountBalance } from "@/lib/features/etradeSlice";
import { selectOrders } from "@/lib/features/etradeSlice";
import { useAppSelector } from "@/lib/hooks";

ModuleRegistry.registerModules([AllCommunityModule]);

const EXIT_ACTIONS_LONG = new Set(["SELL", "SELL_CLOSE"]);
const EXIT_ACTIONS_SHORT = new Set(["BUY", "BUY_CLOSE", "BUY_TO_COVER"]);

function computeOrderDte(leg: OrderLeg): number | null {
  if (!leg.expiryYear || !leg.expiryMonth || !leg.expiryDay) return null;
  const expiry = new Date(leg.expiryYear, leg.expiryMonth - 1, leg.expiryDay);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function legKey(symbol: string, qty: number, strike: number | null, dte: number | null): string {
  return `${symbol}|${qty}|${strike ?? ""}|${dte ?? ""}`;
}

function isExitOrder(posLegs: Position[], order: Order): boolean {
  if (order.legs.length !== posLegs.length) return false;

  const sortedOrder = [...order.legs].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const sortedPos = [...posLegs].sort((a, b) => a.symbol.localeCompare(b.symbol));

  return sortedOrder.every((oLeg, i) => {
    const pLeg = sortedPos[i];
    const keyMatch =
      legKey(oLeg.symbol, oLeg.orderedQuantity, oLeg.strikePrice, computeOrderDte(oLeg)) ===
      legKey(pLeg.symbol, Math.abs(pLeg.quantity), pLeg.strikePrice, pLeg.dte);
    if (!keyMatch) return false;

    const exitActions = pLeg.quantity > 0 ? EXIT_ACTIONS_LONG : EXIT_ACTIONS_SHORT;
    return exitActions.has(oLeg.orderAction);
  });
}

function computeExitLabel(order: Order, row: DisplayRow): string {
  const mult = row.type === "OPTN" ? 100 : 1;
  const exitValue = order.limitPrice * Math.abs(row.quantity) * mult;
  const cost = Math.abs(row.totalCost);
  if (cost === 0) return `@${order.limitPrice.toFixed(2)}`;
  const sign = row.totalCost >= 0 ? 1 : -1;
  const profit = sign * (exitValue - cost);
  const pct = Math.round((profit / cost) * 100);
  return `${pct}% @${order.limitPrice.toFixed(2)}`;
}

interface MatchResult {
  rows: DisplayRow[];
  unmatchedOrders: Order[];
}

function matchOrdersToRows(rows: DisplayRow[], symbolOrders: Order[]): MatchResult {
  const remaining = [...symbolOrders];
  const matched = rows.map((row) => {
    if (!row._legs) return row;
    const idx = remaining.findIndex((o) => isExitOrder(row._legs!, o));
    if (idx === -1) return row;
    const order = remaining.splice(idx, 1)[0];
    return { ...row, exitLabel: computeExitLabel(order, row), exitOrderId: order.orderId };
  });
  return { rows: matched, unmatchedOrders: remaining };
}

interface UnmatchedOrderRow {
  symbolDescription: string;
  orderAction: string;
  quantity: number;
  filled: number;
  limitPrice: number;
  stopPrice: number | null;
  priceType: string;
  orderTerm: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  netBid: number | null;
  netAsk: number | null;
}

function buildUnmatchedRows(orders: Order[]): UnmatchedOrderRow[] {
  const rows: UnmatchedOrderRow[] = [];
  for (const o of orders) {
    for (const leg of o.legs) {
      rows.push({
        symbolDescription: leg.symbolDescription || leg.symbol,
        orderAction: leg.orderAction,
        quantity: leg.orderedQuantity,
        filled: leg.filledQuantity,
        limitPrice: o.limitPrice,
        stopPrice: o.stopPrice,
        priceType: o.priceType,
        orderTerm: o.orderTerm,
        bid: leg.bid,
        ask: leg.ask,
        last: leg.lastprice,
        netBid: o.netBid,
        netAsk: o.netAsk,
      });
    }
  }
  return rows;
}

function priceFormatter(params: ValueFormatterParams): string {
  if (params.value == null) return "";
  return (params.value as number).toFixed(2);
}

const unmatchedColumnDefs: ColDef<UnmatchedOrderRow>[] = [
  { field: "symbolDescription", headerName: "Description", flex: 1, minWidth: 180 },
  { field: "orderAction", headerName: "Action", width: 110 },
  { field: "quantity", headerName: "Qty", width: 70, type: "rightAligned" },
  { field: "filled", headerName: "Filled", width: 70, type: "rightAligned" },
  { field: "priceType", headerName: "Type", width: 90 },
  { field: "limitPrice", headerName: "Limit", width: 90, type: "rightAligned", valueFormatter: priceFormatter },
  { field: "stopPrice", headerName: "Stop", width: 90, type: "rightAligned", valueFormatter: priceFormatter },
  { field: "bid", headerName: "Bid", width: 80, type: "rightAligned", valueFormatter: priceFormatter },
  { field: "ask", headerName: "Ask", width: 80, type: "rightAligned", valueFormatter: priceFormatter },
  { field: "last", headerName: "Last", width: 80, type: "rightAligned", valueFormatter: priceFormatter },
  { field: "netBid", headerName: "Net Bid", width: 90, type: "rightAligned", valueFormatter: priceFormatter },
  { field: "netAsk", headerName: "Net Ask", width: 90, type: "rightAligned", valueFormatter: priceFormatter },
  { field: "orderTerm", headerName: "Term", width: 80 },
];

const precomputedGreekKeys = {
  delta: "_posDelta",
  gamma: "_posGamma",
  theta: "_posTheta",
  vega: "_posVega",
  rho: "_posRho",
} as const;

function positionGreekGetter(
  field: "delta" | "gamma" | "theta" | "vega" | "rho",
) {
  const precomputedKey = precomputedGreekKeys[field];
  return (params: { data: DisplayRow | undefined }) => {
    const p = params.data;
    if (!p) return null;
    // Strategy rows store pre-computed position-level greeks
    if (p.isStrategy) {
      return p[precomputedKey] ?? null;
    }
    const raw = field === "delta" && p.type === "EQ" ? 1 : p[field];
    if (raw == null) return null;
    const multiplier = p.type === "OPTN" ? 100 : 1;
    return raw * p.quantity * multiplier;
  };
}

function greekFormatter(params: ValueFormatterParams): string {
  if (params.value == null) return "";
  return params.value.toFixed(1);
}

interface SymbolGroup {
  baseSymbol: string;
  positions: Position[];
}

interface PositionsGridProps {
  positions: Position[];
  balance?: AccountBalance | null;
  sessionId: string;
  accountKey: string;
}

function qtyFormatter(params: ValueFormatterParams): string {
  if (params.value == null) return "";
  const v = params.value as number;
  return v > 0 ? `+${v}` : `${v}`;
}

function dteCellStyle(params: { value: number | null | undefined }) {
  const dte = params.value;
  if (dte == null) return undefined;
  if (dte < 7) return { color: "oklch(0.637 0.237 25.331)" };
  if (dte <= 30) return { color: "oklch(0.795 0.184 86.047)" };
  return undefined;
}

const columnDefs: ColDef<DisplayRow>[] = [
  {
    field: "quantity",
    headerName: "Qty",
    width: 80,
    type: "rightAligned",
    pinned: "left",
    valueFormatter: qtyFormatter,
  },
  {
    field: "dte",
    headerName: "DTE",
    width: 80,
    type: "rightAligned",
    pinned: "left",
    cellStyle: dteCellStyle,
  },
  {
    field: "spec",
    headerName: "Spec",
    width: 120,
    type: "rightAligned",
    pinned: "left",
  },
  {
    field: "strategyName",
    headerName: "Strategy",
    width: 120,
    pinned: "left",
    filter: true,
  },
  {
    field: "marketValue",
    headerName: "Mkt Value",
    width: 120,
    cellRenderer: DollarCell,
  },
  {
    field: "daysGain",
    headerName: "Day P&L",
    width: 120,
    cellRenderer: DollarCell,
  },
  {
    field: "totalGain",
    headerName: "Total P&L",
    width: 120,
    cellRenderer: PlCell,
    cellRendererParams: { pctField: "totalGainPct" },
  },
  {
    headerName: "Delta",
    width: 110,
    valueGetter: positionGreekGetter("delta"),
    cellRenderer: DollarCell,
  },
  {
    headerName: "Gamma",
    width: 90,
    type: "rightAligned",
    valueGetter: positionGreekGetter("gamma"),
    valueFormatter: greekFormatter,
  },
  {
    headerName: "Theta",
    width: 110,
    valueGetter: positionGreekGetter("theta"),
    cellRenderer: DollarCell,
  },
  {
    headerName: "Vega",
    width: 90,
    type: "rightAligned",
    valueGetter: positionGreekGetter("vega"),
    valueFormatter: greekFormatter,
  },
  {
    headerName: "Rho",
    width: 90,
    type: "rightAligned",
    valueGetter: positionGreekGetter("rho"),
    valueFormatter: greekFormatter,
  },
  {
    field: "iv",
    headerName: "IV %",
    width: 90,
    type: "rightAligned",
    valueFormatter: (params: ValueFormatterParams) => {
      if (params.value == null) return "";
      return `${params.value.toFixed(1)}%`;
    },
  },
  {
    field: "exitLabel",
    headerName: "Exit",
    width: 150,
    pinned: "right",
    cellRenderer: ExitCell,
  },
];

const defaultColDef: ColDef = {
  sortable: true,
  resizable: true,
};

function getRowStyle(params: RowClassParams<DisplayRow>) {
  if (params.data?.isStrategy) {
    return { fontWeight: "bold", backgroundColor: "var(--ag-row-hover-color)" };
  }
  return undefined;
}

export function PositionsGrid({ positions, balance, sessionId, accountKey }: PositionsGridProps) {
  const { resolvedTheme } = useTheme();
  const orders = useAppSelector(selectOrders);
  const gridTheme = useMemo(
    () =>
      themeQuartz.withPart(
        resolvedTheme === "dark" ? colorSchemeDark : colorSchemeLight,
      ),
    [resolvedTheme],
  );

  const ordersBySymbol = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const order of orders) {
      const key = order.baseSymbol;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(order);
    }
    return map;
  }, [orders]);

  const groups = useMemo<SymbolGroup[]>(() => {
    const map = new Map<string, Position[]>();
    for (const pos of positions) {
      const key = pos.baseSymbol;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pos);
    }
    return Array.from(map.entries()).map(([baseSymbol, groupPositions]) => ({
      baseSymbol,
      positions: groupPositions,
    }));
  }, [positions]);

  const firstSymbol = groups[0]?.baseSymbol;
  const [activeTab, setActiveTab] = useState(firstSymbol);

  if (!firstSymbol) return null;

  return (
    <div className="flex flex-col gap-4">
      <AccountSummary positions={positions} balance={balance} gridTheme={gridTheme} onSymbolClick={setActiveTab} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-center">
        <TabsList>
          {groups.map((g) => (
            <TabsTrigger key={g.baseSymbol} value={g.baseSymbol}>
              {g.baseSymbol}
            </TabsTrigger>
          ))}
        </TabsList>
        </div>
        {groups.map((g) => {
          const symbolOrders = ordersBySymbol.get(g.baseSymbol) ?? [];
          const strategyRows = groupIntoStrategies(g.positions);
          const { rows: matchedRows, unmatchedOrders } = matchOrdersToRows(strategyRows, symbolOrders);
          const unmatchedRows = buildUnmatchedRows(unmatchedOrders);
          return (
            <TabsContent key={g.baseSymbol} value={g.baseSymbol}>
              <AgGridReact<DisplayRow>
                theme={gridTheme}
                rowData={matchedRows}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                domLayout="autoHeight"
                getRowStyle={getRowStyle}
                context={{ sessionId, accountKey }}
              />
              {unmatchedRows.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-1">Other Open Orders</div>
                  <AgGridReact<UnmatchedOrderRow>
                    theme={gridTheme}
                    rowData={unmatchedRows}
                    columnDefs={unmatchedColumnDefs}
                    defaultColDef={defaultColDef}
                    domLayout="autoHeight"
                  />
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
