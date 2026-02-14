import type { Position } from "@/lib/features/etradeSlice";

export type DisplayRow = Position & {
  isStrategy?: boolean;
  strategyName?: string;
  spec?: string;
  legCount?: number;
  strikeWidth?: number;
  highStrike?: number;
  exitLabel?: string | null;
  exitOrderId?: number | null;
  _legs?: Position[];
  _posDelta?: number | null;
  _posGamma?: number | null;
  _posTheta?: number | null;
  _posVega?: number | null;
  _posRho?: number | null;
};

export function identifyStrategyName(legs: Position[]): string | null {
  const calls = legs.filter((l) => l.callPut === "CALL");
  const puts = legs.filter((l) => l.callPut === "PUT");

  if (legs.length === 2) {
    const [a, b] = legs;
    const oppositeSign = Math.sign(a.quantity) !== Math.sign(b.quantity);

    if (puts.length === 2 && oppositeSign) return "Put Vertical";
    if (calls.length === 2 && oppositeSign) return "Call Vertical";
    if (calls.length === 1 && puts.length === 1 && !oppositeSign) {
      const strikes = legs.map((l) => l.strikePrice);
      return strikes[0] === strikes[1] ? "Straddle" : "Strangle";
    }
  }

  if (legs.length === 4 && calls.length === 2 && puts.length === 2) {
    const callStrikes = calls.map((l) => l.strikePrice).sort();
    const putStrikes = puts.map((l) => l.strikePrice).sort();
    const sameStrikes =
      callStrikes[0] === putStrikes[0] && callStrikes[1] === putStrikes[1];
    if (sameStrikes) return "Box Spread";
    const sharedMiddle =
      callStrikes[0] === putStrikes[1] || putStrikes[0] === callStrikes[1];
    return sharedMiddle ? "Iron Butterfly" : "Iron Condor";
  }

  return null;
}

function singleLegName(pos: Position): string {
  if (pos.type === "OPTN") {
    return pos.callPut === "PUT" ? "Put" : "Call";
  }
  // Capitalize first letter, lowercase rest (e.g. "EQ" -> "Equity")
  if (pos.type === "EQ") return "Equity";
  return pos.type.charAt(0).toUpperCase() + pos.type.slice(1).toLowerCase();
}

function strategySpec(
  strategyName: string,
  highStrike: number,
  strikeWidth: number,
): string {
  if (strategyName === "Box Spread") {
    return `$${Math.round((strikeWidth * 100) / 1000)}k`;
  }
  if (strategyName === "Put Vertical" || strategyName === "Call Vertical") {
    return `${highStrike}/${strikeWidth}`;
  }
  return "";
}

function singleLegSpec(pos: Position): string {
  if (pos.type === "OPTN" && pos.strikePrice != null) {
    return String(pos.strikePrice);
  }
  return "";
}

function buildStrategyRow(legs: Position[], strategyName: string): DisplayRow {
  const marketValue = legs.reduce((s, l) => s + l.marketValue, 0);
  const daysGain = legs.reduce((s, l) => s + l.daysGain, 0);
  const totalGain = legs.reduce((s, l) => s + l.totalGain, 0);
  const totalCost = legs.reduce((s, l) => s + l.totalCost, 0);

  const absQty = Math.abs(legs[0].quantity);
  const signFromCost =
    strategyName === "Put Vertical" ||
    strategyName === "Call Vertical" ||
    strategyName === "Box Spread";
  const qty = signFromCost
    ? totalCost >= 0
      ? absQty
      : -absQty
    : absQty;

  const prevMarketValue = marketValue - daysGain;
  const dayGainPct =
    prevMarketValue !== 0 ? (daysGain / Math.abs(prevMarketValue)) * 100 : 0;
  const totalGainPct =
    totalCost !== 0 ? (totalGain / Math.abs(totalCost)) * 100 : 0;

  const sumGreek = (field: "delta" | "gamma" | "theta" | "vega" | "rho") =>
    legs.reduce<number | null>((acc, l) => {
      if (l[field] == null) return acc;
      const multiplier = l.type === "OPTN" ? 100 : 1;
      const val = l[field]! * l.quantity * multiplier;
      return (acc ?? 0) + val;
    }, null);

  const strikes = legs
    .map((l) => l.strikePrice ?? 0)
    .sort((a, b) => a - b);
  const highStrike = strikes[strikes.length - 1];
  const strikeWidth = highStrike - strikes[0];

  return {
    ...legs[0],
    symbol: `${qty} x ${strategyName}`,
    quantity: qty,
    marketValue,
    daysGain,
    dayGainPct,
    totalGain,
    totalGainPct,
    totalCost,
    isStrategy: true,
    strategyName,
    spec: strategySpec(strategyName, highStrike, strikeWidth),
    _legs: legs,
    legCount: legs.length,
    strikeWidth,
    highStrike,
    delta: null,
    gamma: null,
    theta: null,
    vega: null,
    rho: null,
    iv: null,
    _posDelta: sumGreek("delta"),
    _posGamma: sumGreek("gamma"),
    _posTheta: sumGreek("theta"),
    _posVega: sumGreek("vega"),
    _posRho: sumGreek("rho"),
  };
}

function trySplitIntoPairs(
  legs: Position[],
): [Position[], string, Position[], string] | null {
  if (legs.length !== 4) return null;
  const pairings: [number, number, number, number][] = [
    [0, 1, 2, 3],
    [0, 2, 1, 3],
    [0, 3, 1, 2],
  ];
  for (const [a, b, c, d] of pairings) {
    const pair1 = [legs[a], legs[b]];
    const pair2 = [legs[c], legs[d]];
    const name1 = identifyStrategyName(pair1);
    const name2 = identifyStrategyName(pair2);
    if (name1 != null && name2 != null) return [pair1, name1, pair2, name2];
  }
  return null;
}

export function groupIntoStrategies(positions: Position[]): DisplayRow[] {
  const strategyMap = new Map<string, Position[]>();
  const standalones: Position[] = [];

  for (const pos of positions) {
    if (pos.type !== "OPTN") {
      standalones.push(pos);
      continue;
    }
    const key = `${pos.baseSymbol}|${pos.dte}|${pos.dateAcquired}|${Math.abs(pos.quantity)}`;
    if (!strategyMap.has(key)) strategyMap.set(key, []);
    strategyMap.get(key)!.push(pos);
  }

  const rows: DisplayRow[] = [];

  for (const pos of standalones) {
    rows.push({ ...pos, strategyName: singleLegName(pos), spec: singleLegSpec(pos), _legs: [pos] });
  }

  for (const legs of strategyMap.values()) {
    if (legs.length === 1) {
      rows.push({ ...legs[0], strategyName: singleLegName(legs[0]), spec: singleLegSpec(legs[0]), _legs: [legs[0]] });
      continue;
    }

    const strategyName = identifyStrategyName(legs);
    if (strategyName != null) {
      rows.push(buildStrategyRow(legs, strategyName));
      continue;
    }

    const split = trySplitIntoPairs(legs);
    if (split != null) {
      const [pair1, name1, pair2, name2] = split;
      rows.push(buildStrategyRow(pair1, name1));
      rows.push(buildStrategyRow(pair2, name2));
      continue;
    }

    for (const leg of legs) {
      rows.push({ ...leg, strategyName: singleLegName(leg), spec: singleLegSpec(leg), _legs: [leg] });
    }
  }

  return rows;
}
