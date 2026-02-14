import { describe, it, expect } from "vitest";
import type { Position } from "@/lib/features/etradeSlice";
import { identifyStrategyName, groupIntoStrategies } from "./strategies";

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    symbol: "AAPL",
    baseSymbol: "AAPL",
    description: "AAPL",
    type: "OPTN",
    strikePrice: 200,
    callPut: "CALL",
    quantity: 1,
    pricePaid: 5,
    marketValue: 500,
    totalCost: 500,
    dayGain: 10,
    dayGainPct: 2,
    totalGain: 50,
    totalGainPct: 10,
    lastPrice: 5.5,
    daysGain: 10,
    pctOfPortfolio: 5,
    costPerShare: 5,
    dte: 30,
    delta: 0.5,
    gamma: 0.03,
    theta: -0.05,
    vega: 0.15,
    rho: 0.01,
    iv: 25,
    intrinsicValue: 2,
    premium: 3,
    openInterest: 1000,
    dateAcquired: 1700000000,
    expiryYear: null,
    expiryMonth: null,
    expiryDay: null,
    ...overrides,
  };
}

describe("identifyStrategyName", () => {
  it("returns 'Put Vertical' for two puts with opposite signs", () => {
    const legs = [
      makePosition({ callPut: "PUT", strikePrice: 190, quantity: 1 }),
      makePosition({ callPut: "PUT", strikePrice: 200, quantity: -1 }),
    ];
    expect(identifyStrategyName(legs)).toBe("Put Vertical");
  });

  it("returns 'Call Vertical' for two calls with opposite signs", () => {
    const legs = [
      makePosition({ callPut: "CALL", strikePrice: 200, quantity: 1 }),
      makePosition({ callPut: "CALL", strikePrice: 210, quantity: -1 }),
    ];
    expect(identifyStrategyName(legs)).toBe("Call Vertical");
  });

  it("returns 'Straddle' for call+put same strike same sign", () => {
    const legs = [
      makePosition({ callPut: "CALL", strikePrice: 200, quantity: 1 }),
      makePosition({ callPut: "PUT", strikePrice: 200, quantity: 1 }),
    ];
    expect(identifyStrategyName(legs)).toBe("Straddle");
  });

  it("returns 'Strangle' for call+put different strikes same sign", () => {
    const legs = [
      makePosition({ callPut: "CALL", strikePrice: 210, quantity: 1 }),
      makePosition({ callPut: "PUT", strikePrice: 190, quantity: 1 }),
    ];
    expect(identifyStrategyName(legs)).toBe("Strangle");
  });

  it("returns 'Box Spread' for 4-leg with matching call/put strikes", () => {
    const legs = [
      makePosition({ callPut: "CALL", strikePrice: 190, quantity: 1 }),
      makePosition({ callPut: "CALL", strikePrice: 210, quantity: -1 }),
      makePosition({ callPut: "PUT", strikePrice: 190, quantity: -1 }),
      makePosition({ callPut: "PUT", strikePrice: 210, quantity: 1 }),
    ];
    expect(identifyStrategyName(legs)).toBe("Box Spread");
  });

  it("returns 'Iron Butterfly' for 4-leg with shared middle strike", () => {
    const legs = [
      makePosition({ callPut: "PUT", strikePrice: 190, quantity: 1 }),
      makePosition({ callPut: "PUT", strikePrice: 200, quantity: -1 }),
      makePosition({ callPut: "CALL", strikePrice: 200, quantity: -1 }),
      makePosition({ callPut: "CALL", strikePrice: 210, quantity: 1 }),
    ];
    expect(identifyStrategyName(legs)).toBe("Iron Butterfly");
  });

  it("returns 'Iron Condor' for 4-leg without shared middle or matching strikes", () => {
    const legs = [
      makePosition({ callPut: "PUT", strikePrice: 180, quantity: 1 }),
      makePosition({ callPut: "PUT", strikePrice: 190, quantity: -1 }),
      makePosition({ callPut: "CALL", strikePrice: 210, quantity: -1 }),
      makePosition({ callPut: "CALL", strikePrice: 220, quantity: 1 }),
    ];
    expect(identifyStrategyName(legs)).toBe("Iron Condor");
  });

  it("returns null for unknown combinations", () => {
    const legs = [
      makePosition({ callPut: "CALL", strikePrice: 200, quantity: 1 }),
      makePosition({ callPut: "CALL", strikePrice: 210, quantity: 1 }),
      makePosition({ callPut: "CALL", strikePrice: 220, quantity: 1 }),
    ];
    expect(identifyStrategyName(legs)).toBeNull();
  });
});

describe("groupIntoStrategies", () => {
  it("passes through a single equity with strategyName 'Equity'", () => {
    const pos = makePosition({
      type: "EQ",
      callPut: null,
      strikePrice: null,
      dte: null,
      delta: null,
      gamma: null,
      theta: null,
      vega: null,
      rho: null,
      iv: null,
      intrinsicValue: null,
      premium: null,
      openInterest: null,
      dateAcquired: null,
    });
    const rows = groupIntoStrategies([pos]);
    expect(rows).toHaveLength(1);
    expect(rows[0].strategyName).toBe("Equity");
    expect(rows[0].spec).toBe("");
    expect(rows[0].isStrategy).toBeUndefined();
  });

  it("gives a single put option strategyName 'Put' with strike as spec", () => {
    const pos = makePosition({ callPut: "PUT", strikePrice: 195 });
    const rows = groupIntoStrategies([pos]);
    expect(rows).toHaveLength(1);
    expect(rows[0].strategyName).toBe("Put");
    expect(rows[0].spec).toBe("195");
  });

  it("gives a single call option strategyName 'Call' with strike as spec", () => {
    const pos = makePosition({ callPut: "CALL", strikePrice: 210 });
    const rows = groupIntoStrategies([pos]);
    expect(rows).toHaveLength(1);
    expect(rows[0].strategyName).toBe("Call");
    expect(rows[0].spec).toBe("210");
  });

  it("groups a debit put vertical with positive quantity", () => {
    const legs = [
      makePosition({
        symbol: "AAPL 200P",
        callPut: "PUT",
        strikePrice: 190,
        quantity: 1,
        totalCost: 200,
        dte: 30,
        dateAcquired: 1700000000,
      }),
      makePosition({
        symbol: "AAPL 210P",
        callPut: "PUT",
        strikePrice: 200,
        quantity: -1,
        totalCost: -100,
        dte: 30,
        dateAcquired: 1700000000,
      }),
    ];
    const rows = groupIntoStrategies(legs);
    expect(rows).toHaveLength(1);
    expect(rows[0].isStrategy).toBe(true);
    expect(rows[0].strategyName).toBe("Put Vertical");
    expect(rows[0].legCount).toBe(2);
    expect(rows[0].quantity).toBe(1);
    expect(rows[0].symbol).toBe("1 x Put Vertical");
    expect(rows[0].spec).toBe("200/10");
    expect(rows[0].highStrike).toBe(200);
    expect(rows[0].strikeWidth).toBe(10);
  });

  it("groups a credit put vertical with negative quantity", () => {
    const legs = [
      makePosition({
        symbol: "AAPL 200P",
        callPut: "PUT",
        strikePrice: 200,
        quantity: -1,
        totalCost: -300,
        dte: 30,
        dateAcquired: 1700000000,
      }),
      makePosition({
        symbol: "AAPL 190P",
        callPut: "PUT",
        strikePrice: 190,
        quantity: 1,
        totalCost: 100,
        dte: 30,
        dateAcquired: 1700000000,
      }),
    ];
    const rows = groupIntoStrategies(legs);
    expect(rows).toHaveLength(1);
    expect(rows[0].strategyName).toBe("Put Vertical");
    expect(rows[0].quantity).toBe(-1);
    expect(rows[0].symbol).toBe("-1 x Put Vertical");
    expect(rows[0].spec).toBe("200/10");
    expect(rows[0].highStrike).toBe(200);
    expect(rows[0].strikeWidth).toBe(10);
  });

  it("groups a credit box spread with negative quantity", () => {
    const legs = [
      makePosition({
        callPut: "CALL",
        strikePrice: 190,
        quantity: -1,
        totalCost: -400,
        dte: 30,
        dateAcquired: 1700000000,
      }),
      makePosition({
        callPut: "CALL",
        strikePrice: 210,
        quantity: 1,
        totalCost: 100,
        dte: 30,
        dateAcquired: 1700000000,
      }),
      makePosition({
        callPut: "PUT",
        strikePrice: 190,
        quantity: 1,
        totalCost: 50,
        dte: 30,
        dateAcquired: 1700000000,
      }),
      makePosition({
        callPut: "PUT",
        strikePrice: 210,
        quantity: -1,
        totalCost: -200,
        dte: 30,
        dateAcquired: 1700000000,
      }),
    ];
    const rows = groupIntoStrategies(legs);
    expect(rows).toHaveLength(1);
    expect(rows[0].strategyName).toBe("Box Spread");
    expect(rows[0].quantity).toBe(-1);
    expect(rows[0].symbol).toBe("-1 x Box Spread");
    expect(rows[0].spec).toBe("$2k");
    expect(rows[0].highStrike).toBe(210);
    expect(rows[0].strikeWidth).toBe(20);
  });

  it("keeps unknown multi-leg combos ungrouped with individual names", () => {
    const legs = [
      makePosition({
        callPut: "CALL",
        strikePrice: 200,
        quantity: 1,
        dte: 30,
        dateAcquired: 1700000000,
      }),
      makePosition({
        callPut: "CALL",
        strikePrice: 210,
        quantity: 1,
        dte: 30,
        dateAcquired: 1700000000,
      }),
      makePosition({
        callPut: "PUT",
        strikePrice: 190,
        quantity: 1,
        dte: 30,
        dateAcquired: 1700000000,
      }),
    ];
    const rows = groupIntoStrategies(legs);
    expect(rows).toHaveLength(3);
    expect(rows[0].strategyName).toBe("Call");
    expect(rows[1].strategyName).toBe("Call");
    expect(rows[2].strategyName).toBe("Put");
    expect(rows.every((r) => !r.isStrategy)).toBe(true);
  });

  it("splits unrecognized 4-leg into two 2-leg strategies", () => {
    // Two separate put verticals — 4 puts don't match any 4-leg pattern
    const legs = [
      makePosition({
        callPut: "PUT",
        strikePrice: 190,
        quantity: 1,
        dte: 30,
        dateAcquired: 1700000000,
        totalCost: 300,
      }),
      makePosition({
        callPut: "PUT",
        strikePrice: 200,
        quantity: -1,
        dte: 30,
        dateAcquired: 1700000000,
        totalCost: -200,
      }),
      makePosition({
        callPut: "PUT",
        strikePrice: 210,
        quantity: 1,
        dte: 30,
        dateAcquired: 1700000000,
        totalCost: 250,
      }),
      makePosition({
        callPut: "PUT",
        strikePrice: 220,
        quantity: -1,
        dte: 30,
        dateAcquired: 1700000000,
        totalCost: -150,
      }),
    ];
    const rows = groupIntoStrategies(legs);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.strategyName === "Put Vertical")).toBe(true);
    expect(rows.every((r) => r.isStrategy)).toBe(true);
    expect(rows.every((r) => r.legCount === 2)).toBe(true);
  });

  it("falls back to ungrouped singles when 4-leg cannot split into pairs", () => {
    // 4 calls, same sign — no 4-leg match, no valid 2-leg pairing
    const legs = [
      makePosition({
        callPut: "CALL",
        strikePrice: 200,
        quantity: 1,
        dte: 30,
        dateAcquired: 1700000000,
      }),
      makePosition({
        callPut: "CALL",
        strikePrice: 210,
        quantity: 1,
        dte: 30,
        dateAcquired: 1700000000,
      }),
      makePosition({
        callPut: "CALL",
        strikePrice: 220,
        quantity: 1,
        dte: 30,
        dateAcquired: 1700000000,
      }),
      makePosition({
        callPut: "CALL",
        strikePrice: 230,
        quantity: 1,
        dte: 30,
        dateAcquired: 1700000000,
      }),
    ];
    const rows = groupIntoStrategies(legs);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.strategyName === "Call")).toBe(true);
    expect(rows.every((r) => !r.isStrategy)).toBe(true);
  });

  it("aggregates marketValue, daysGain, totalGain on strategy row", () => {
    const legs = [
      makePosition({
        callPut: "PUT",
        strikePrice: 190,
        quantity: 2,
        dte: 30,
        dateAcquired: 1700000000,
        marketValue: 300,
        daysGain: 20,
        totalGain: 40,
        totalCost: 260,
      }),
      makePosition({
        callPut: "PUT",
        strikePrice: 200,
        quantity: -2,
        dte: 30,
        dateAcquired: 1700000000,
        marketValue: -100,
        daysGain: -5,
        totalGain: -10,
        totalCost: -90,
      }),
    ];
    const rows = groupIntoStrategies(legs);
    expect(rows).toHaveLength(1);
    expect(rows[0].marketValue).toBe(200);
    expect(rows[0].daysGain).toBe(15);
    expect(rows[0].totalGain).toBe(30);
    expect(rows[0].totalCost).toBe(170);
  });
});
