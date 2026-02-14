import { useMemo } from "react";
import { Info } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, RowClickedEvent, ValueFormatterParams } from "ag-grid-community";
import type { Theme } from "ag-grid-community";
import { DollarCell } from "@/components/app/dollar-cell";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Position, AccountBalance } from "@/lib/features/etradeSlice";

function sumField(positions: Position[], field: keyof Position): number {
  return positions.reduce((acc, p) => {
    const v = p[field];
    return acc + (typeof v === "number" ? v : 0);
  }, 0);
}

function sumPositionGreek(
  positions: Position[],
  field: "delta" | "gamma" | "theta" | "vega" | "rho",
): number {
  return positions.reduce((acc, p) => {
    const greekVal = field === "delta" && p.type === "EQ" ? 1 : p[field];
    if (typeof greekVal !== "number") return acc;
    const multiplier = p.type === "OPTN" ? 100 : 1;
    return acc + greekVal * p.quantity * multiplier;
  }, 0);
}

function sumDeltaSplit(positions: Position[]): { pos: number; neg: number } {
  let pos = 0;
  let neg = 0;
  for (const p of positions) {
    const greekVal = p.type === "EQ" ? 1 : p.delta;
    if (typeof greekVal !== "number") continue;
    const multiplier = p.type === "OPTN" ? 100 : 1;
    const posDelta = greekVal * p.quantity * multiplier;
    if (posDelta > 0) pos += posDelta;
    else neg += posDelta;
  }
  return { pos, neg };
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

function greekFormatter(params: ValueFormatterParams): string {
  if (params.value == null) return "";
  return params.value.toFixed(1);
}

interface SummaryRow {
  baseSymbol: string;
  marketValue: number;
  dayPl: number;
  totalPl: number;
  deltaPos: number;
  deltaNeg: number;
  deltaNet: number;
  gamma: number;
  theta: number;
}

const columnDefs: ColDef<SummaryRow>[] = [
  {
    field: "baseSymbol",
    headerName: "Symbol",
    width: 100,
    pinned: "left",
  },
  {
    field: "marketValue",
    headerName: "Mkt Value",
    width: 120,
    cellRenderer: DollarCell,
  },
  {
    field: "dayPl",
    headerName: "Day P&L",
    width: 120,
    cellRenderer: DollarCell,
  },
  {
    field: "totalPl",
    headerName: "Total P&L",
    width: 120,
    cellRenderer: DollarCell,
  },
  {
    field: "deltaPos",
    headerName: "+Delta",
    width: 110,
    cellRenderer: DollarCell,
  },
  {
    field: "deltaNeg",
    headerName: "-Delta",
    width: 110,
    cellRenderer: DollarCell,
  },
  {
    field: "deltaNet",
    headerName: "Net Delta",
    width: 110,
    cellRenderer: DollarCell,
  },
  {
    field: "gamma",
    headerName: "Gamma",
    width: 90,
    type: "rightAligned",
    valueFormatter: greekFormatter,
  },
  {
    field: "theta",
    headerName: "Theta",
    width: 110,
    cellRenderer: DollarCell,
  },
];

const defaultColDef: ColDef = {
  sortable: true,
  resizable: true,
};

interface AccountSummaryProps {
  positions: Position[];
  balance?: AccountBalance | null;
  gridTheme: Theme;
  onSymbolClick?: (symbol: string) => void;
}

export function AccountSummary({ positions, balance, gridTheme, onSymbolClick }: AccountSummaryProps) {
  const { rows, pinnedRow } = useMemo(() => {
    const map = new Map<string, Position[]>();
    for (const pos of positions) {
      const key = pos.baseSymbol;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pos);
    }

    const symbolRows: SummaryRow[] = Array.from(map.entries()).map(
      ([baseSymbol, group]) => {
        const ds = sumDeltaSplit(group);
        return {
          baseSymbol,
          deltaPos: ds.pos,
          deltaNeg: ds.neg,
          deltaNet: ds.pos + ds.neg,
          gamma: sumPositionGreek(group, "gamma"),
          theta: sumPositionGreek(group, "theta"),
          dayPl: sumField(group, "daysGain"),
          totalPl: sumField(group, "totalGain"),
          marketValue: sumField(group, "marketValue"),
        };
      },
    );

    const totalDs = sumDeltaSplit(positions);
    const totals: SummaryRow = {
      baseSymbol: "Total",
      marketValue: sumField(positions, "marketValue"),
      dayPl: sumField(positions, "daysGain"),
      totalPl: sumField(positions, "totalGain"),
      deltaPos: totalDs.pos,
      deltaNeg: totalDs.neg,
      deltaNet: totalDs.pos + totalDs.neg,
      gamma: sumPositionGreek(positions, "gamma"),
      theta: sumPositionGreek(positions, "theta"),
    };

    return { rows: symbolRows, pinnedRow: [totals] };
  }, [positions]);

  return (
    <div className="flex flex-col gap-3">
      {balance && (() => {
        const computed = balance?.Computed ?? {};
        const rt = computed.RealTimeValues ?? {};
        const total: number = rt.totalAccountValue ?? 0;
        const netMv: number = rt.netMv ?? 0;
        const netMvShort: number = rt.netMvShort ?? 0;
        const cashBuyingPower: number = computed.cashBuyingPower ?? 0;
        const safetyPct = total !== 0 ? (cashBuyingPower / total) * 100 : 0;
        return (
          <div className="grid grid-cols-4 gap-3">
            <div className="border rounded-lg px-3 py-2">
              <div className="text-xs text-muted-foreground">Total Value</div>
              <div className="text-lg font-semibold font-mono">{formatCompact(total)}</div>
            </div>
            <div className="border rounded-lg px-3 py-2">
              <div className="text-xs text-muted-foreground">Cash</div>
              <div className="text-lg font-semibold font-mono">{formatCompact(total - netMv)}</div>
            </div>
            <div className="border rounded-lg px-3 py-2">
              <div className="text-xs text-muted-foreground">Short</div>
              <div className="text-lg font-semibold font-mono">{formatCompact(netMvShort)}</div>
            </div>
            <div className="border rounded-lg px-3 py-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Safety
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Cash Buying Power / Total Value</p>
                      <p>Above 40%: Safe</p>
                      <p>30–40%: OK</p>
                      <p>Below 20%: Danger</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-lg font-semibold font-mono">{safetyPct.toFixed(1)}%</div>
            </div>
          </div>
        );
      })()}
      <AgGridReact<SummaryRow>
        theme={gridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        domLayout="autoHeight"
        pinnedBottomRowData={pinnedRow}
        onRowClicked={(e: RowClickedEvent<SummaryRow>) => {
          const symbol = e.data?.baseSymbol;
          if (symbol && symbol !== "Total" && onSymbolClick) {
            onSymbolClick(symbol);
          }
        }}
      />
    </div>
  );
}
