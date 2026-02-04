import { describe, it, expect } from "vitest";
import counterReducer, {
  increment,
  decrement,
  incrementByAmount,
} from "./counterSlice";

describe("counterSlice", () => {
  const initialState = { value: 0 };

  it("should return the initial state", () => {
    expect(counterReducer(undefined, { type: "unknown" })).toEqual(
      initialState,
    );
  });

  it("should handle increment", () => {
    expect(counterReducer(initialState, increment())).toEqual({ value: 1 });
  });

  it("should handle decrement", () => {
    expect(counterReducer(initialState, decrement())).toEqual({ value: -1 });
  });

  it("should handle incrementByAmount", () => {
    expect(counterReducer(initialState, incrementByAmount(5))).toEqual({
      value: 5,
    });
  });
});
