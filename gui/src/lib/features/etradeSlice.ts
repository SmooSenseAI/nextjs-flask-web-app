import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState } from "../store";

export interface ETradeAccount {
  accountId: string;
  accountIdKey: string;
  accountName: string;
  accountDesc: string;
  accountType: string;
  accountMode: string;
  accountStatus: string;
  institutionType: string;
}

export interface Position {
  symbol: string;
  baseSymbol: string;
  description: string;
  type: string;
  strikePrice: number | null;
  callPut: string | null;
  quantity: number;
  pricePaid: number;
  marketValue: number;
  totalCost: number;
  dayGain: number;
  dayGainPct: number;
  totalGain: number;
  totalGainPct: number;
  lastPrice: number;
  daysGain: number;
  pctOfPortfolio: number;
  costPerShare: number;
  // Options Greeks (null for non-options)
  dte: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  iv: number | null;
  intrinsicValue: number | null;
  premium: number | null;
  openInterest: number | null;
  dateAcquired: number | null;
  expiryYear: number | null;
  expiryMonth: number | null;
  expiryDay: number | null;
}

export interface OrderLeg {
  symbol: string;
  baseSymbol: string;
  symbolDescription: string;
  orderedQuantity: number;
  filledQuantity: number;
  orderAction: string;
  strikePrice: number | null;
  callPut: string | null;
  expiryYear: number | null;
  expiryMonth: number | null;
  expiryDay: number | null;
  bid: number | null;
  ask: number | null;
  lastprice: number | null;
  estimatedCommission: number | null;
}

export interface Order {
  orderId: number | null;
  orderType: string;
  limitPrice: number;
  stopPrice: number | null;
  priceType: string;
  orderTerm: string;
  marketSession: string;
  placedTime: number | null;
  netPrice: number | null;
  netBid: number | null;
  netAsk: number | null;
  status: string;
  allOrNone: boolean;
  baseSymbol: string;
  legs: OrderLeg[];
}

// Raw BalanceResponse from E*Trade API — kept as a loose record
// so we can inspect and extract new fields without changing the type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AccountBalance = Record<string, any>;

type ConnectionStatus =
  | "disconnected"
  | "restoring"
  | "awaiting_code"
  | "authenticating"
  | "connected";

interface ETradeState {
  status: ConnectionStatus;
  sessionId: string | null;
  authorizeUrl: string | null;
  accounts: ETradeAccount[];
  selectedAccountKey: string | null;
  positions: Position[];
  orders: Order[];
  balance: AccountBalance | null;
  loading: boolean;
  error: string | null;
}

const initialState: ETradeState = {
  status: "disconnected",
  sessionId: null,
  authorizeUrl: null,
  accounts: [],
  selectedAccountKey: null,
  positions: [],
  orders: [],
  balance: null,
  loading: false,
  error: null,
};

export const restoreSession = createAsyncThunk(
  "etrade/restoreSession",
  async (_, { dispatch }) => {
    const res = await fetch("/api/etrade/auth/status");
    if (!res.ok) return null;
    const data = (await res.json()) as {
      authenticated: boolean;
      sessionId?: string;
    };
    if (data.authenticated && data.sessionId) {
      await dispatch(fetchAccounts(data.sessionId));
      return data.sessionId;
    }
    return null;
  },
);

export const logoutSession = createAsyncThunk(
  "etrade/logoutSession",
  async () => {
    await fetch("/api/etrade/auth/logout", { method: "POST" });
  },
);

export const requestToken = createAsyncThunk(
  "etrade/requestToken",
  async () => {
    const res = await fetch("/api/etrade/auth/request-token", {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to get request token");
    }
    return res.json() as Promise<{ sessionId: string; authorizeUrl: string }>;
  },
);

export const exchangeAccessToken = createAsyncThunk(
  "etrade/exchangeAccessToken",
  async (
    { sessionId, verifierCode }: { sessionId: string; verifierCode: string },
    { dispatch },
  ) => {
    const res = await fetch("/api/etrade/auth/access-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, verifierCode }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to exchange access token");
    }
    // After successful auth, fetch accounts
    await dispatch(fetchAccounts(sessionId));
  },
);

const SELECTED_ACCOUNT_KEY = "itrade:selectedAccountKey";

export const fetchAccounts = createAsyncThunk(
  "etrade/fetchAccounts",
  async (sessionId: string, { dispatch, rejectWithValue }) => {
    const res = await fetch("/api/etrade/accounts", {
      headers: { "X-Session-Id": sessionId },
    });
    if (!res.ok) {
      const err = await res.json();
      return rejectWithValue({ status: res.status, message: err.error || "Failed to fetch accounts" });
    }
    const data = (await res.json()) as { accounts: ETradeAccount[] };
    if (data.accounts.length > 0) {
      const saved = localStorage.getItem(SELECTED_ACCOUNT_KEY);
      const match = data.accounts.find((a) => a.accountIdKey === saved);
      const accountKey = match
        ? match.accountIdKey
        : data.accounts[0].accountIdKey;
      dispatch(fetchPositions({ sessionId, accountKey }));
      dispatch(fetchBalance({ sessionId, accountKey }));
      dispatch(fetchOrders({ sessionId, accountKey }));
    }
    return data.accounts;
  },
);

export const fetchPositions = createAsyncThunk(
  "etrade/fetchPositions",
  async ({
    sessionId,
    accountKey,
  }: {
    sessionId: string;
    accountKey: string;
  }, { rejectWithValue }) => {
    const res = await fetch(`/api/etrade/accounts/${accountKey}/positions`, {
      headers: { "X-Session-Id": sessionId },
    });
    if (!res.ok) {
      const err = await res.json();
      return rejectWithValue({ status: res.status, message: err.error || "Failed to fetch positions" });
    }
    const data = (await res.json()) as { positions: Position[] };
    return { positions: data.positions, accountKey };
  },
);

export const fetchBalance = createAsyncThunk(
  "etrade/fetchBalance",
  async ({
    sessionId,
    accountKey,
  }: {
    sessionId: string;
    accountKey: string;
  }, { rejectWithValue }) => {
    const res = await fetch(`/api/etrade/accounts/${accountKey}/balance`, {
      headers: { "X-Session-Id": sessionId },
    });
    if (!res.ok) {
      const err = await res.json();
      return rejectWithValue({ status: res.status, message: err.error || "Failed to fetch balance" });
    }
    const data = (await res.json()) as { balance: AccountBalance };
    return data.balance;
  },
);

export const fetchOrders = createAsyncThunk(
  "etrade/fetchOrders",
  async ({
    sessionId,
    accountKey,
  }: {
    sessionId: string;
    accountKey: string;
  }, { rejectWithValue }) => {
    const res = await fetch(`/api/etrade/accounts/${accountKey}/orders`, {
      headers: { "X-Session-Id": sessionId },
    });
    if (!res.ok) {
      const err = await res.json();
      return rejectWithValue({ status: res.status, message: err.error || "Failed to fetch orders" });
    }
    const data = (await res.json()) as { orders: Order[] };
    return data.orders;
  },
);

export interface ExitOrderLeg {
  symbol: string;
  orderAction: string;
  quantity: number;
  expiryDate: string;
  callPut: string;
  strikePrice: number;
}

export type ExitOrderBody =
  | {
      symbol: string;
      securityType: string;
      orderAction: string;
      quantity: number;
      limitPrice: number;
      expiryDate?: string;
      callPut?: string;
      strikePrice?: number;
    }
  | {
      limitPrice: number;
      priceType: string;
      legs: ExitOrderLeg[];
    };

export const placeExitOrder = createAsyncThunk(
  "etrade/placeExitOrder",
  async (
    {
      sessionId,
      accountKey,
      body,
    }: {
      sessionId: string;
      accountKey: string;
      body: ExitOrderBody;
    },
    { dispatch },
  ) => {
    const res = await fetch(`/api/etrade/accounts/${accountKey}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": sessionId,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to place order");
    }
    const result = await res.json();
    dispatch(fetchOrders({ sessionId, accountKey }));
    return result;
  },
);

export const cancelOrder = createAsyncThunk(
  "etrade/cancelOrder",
  async (
    {
      sessionId,
      accountKey,
      orderId,
    }: {
      sessionId: string;
      accountKey: string;
      orderId: number;
    },
    { dispatch },
  ) => {
    const res = await fetch(
      `/api/etrade/accounts/${accountKey}/orders/${orderId}`,
      {
        method: "DELETE",
        headers: { "X-Session-Id": sessionId },
      },
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to cancel order");
    }
    const result = await res.json();
    dispatch(fetchOrders({ sessionId, accountKey }));
    return result;
  },
);

export const cancelAndPlaceExitOrder = createAsyncThunk(
  "etrade/cancelAndPlaceExitOrder",
  async (
    {
      sessionId,
      accountKey,
      existingOrderId,
      body,
    }: {
      sessionId: string;
      accountKey: string;
      existingOrderId: number | null;
      body: ExitOrderBody;
    },
    { dispatch },
  ) => {
    if (existingOrderId != null) {
      await dispatch(
        cancelOrder({ sessionId, accountKey, orderId: existingOrderId }),
      ).unwrap();
    }
    return dispatch(
      placeExitOrder({ sessionId, accountKey, body }),
    ).unwrap();
  },
);

const etradeSlice = createSlice({
  name: "etrade",
  initialState,
  reducers: {
    selectAccount(state, action: { payload: string }) {
      state.selectedAccountKey = action.payload;
      localStorage.setItem(SELECTED_ACCOUNT_KEY, action.payload);
    },
    disconnect(state) {
      Object.assign(state, initialState);
    },
  },
  extraReducers: (builder) => {
    builder
      // restoreSession
      .addCase(restoreSession.pending, (state) => {
        state.status = "restoring";
        state.loading = true;
        state.error = null;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.sessionId = action.payload;
          state.status = "connected";
        } else {
          state.status = "disconnected";
        }
      })
      .addCase(restoreSession.rejected, (state) => {
        state.loading = false;
        state.status = "disconnected";
      })
      // logoutSession
      .addCase(logoutSession.fulfilled, (state) => {
        Object.assign(state, initialState);
      })
      // requestToken
      .addCase(requestToken.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(requestToken.fulfilled, (state, action) => {
        state.loading = false;
        state.sessionId = action.payload.sessionId;
        state.authorizeUrl = action.payload.authorizeUrl;
        state.status = "awaiting_code";
      })
      .addCase(requestToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to request token";
      })
      // exchangeAccessToken
      .addCase(exchangeAccessToken.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.status = "authenticating";
      })
      .addCase(exchangeAccessToken.fulfilled, (state) => {
        state.loading = false;
        state.status = "connected";
      })
      .addCase(exchangeAccessToken.rejected, (state, action) => {
        state.loading = false;
        state.status = "awaiting_code";
        state.error = action.error.message || "Failed to authenticate";
      })
      // fetchAccounts
      .addCase(fetchAccounts.fulfilled, (state, action) => {
        state.accounts = action.payload;
        if (action.payload.length > 0) {
          const saved = localStorage.getItem(SELECTED_ACCOUNT_KEY);
          const match = action.payload.find((a) => a.accountIdKey === saved);
          state.selectedAccountKey = match
            ? match.accountIdKey
            : action.payload[0].accountIdKey;
        }
      })
      .addCase(fetchAccounts.rejected, (state, action) => {
        const payload = action.payload as { status: number; message: string } | undefined;
        if (payload?.status === 401) {
          Object.assign(state, initialState);
        } else {
          state.error = payload?.message || action.error.message || "Failed to fetch accounts";
        }
      })
      // fetchPositions
      .addCase(fetchPositions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPositions.fulfilled, (state, action) => {
        state.loading = false;
        state.positions = action.payload.positions;
        state.selectedAccountKey = action.payload.accountKey;
      })
      .addCase(fetchPositions.rejected, (state, action) => {
        const payload = action.payload as { status: number; message: string } | undefined;
        if (payload?.status === 401) {
          Object.assign(state, initialState);
        } else {
          state.loading = false;
          state.error = payload?.message || action.error.message || "Failed to fetch positions";
        }
      })
      // fetchBalance
      .addCase(fetchBalance.fulfilled, (state, action) => {
        state.balance = action.payload;
      })
      .addCase(fetchBalance.rejected, (state, action) => {
        const payload = action.payload as { status: number; message: string } | undefined;
        if (payload?.status === 401) {
          Object.assign(state, initialState);
        }
      })
      // fetchOrders
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.orders = action.payload;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        const payload = action.payload as { status: number; message: string } | undefined;
        if (payload?.status === 401) {
          Object.assign(state, initialState);
        }
      });
  },
});

export const { selectAccount, disconnect } = etradeSlice.actions;

export const selectETradeStatus = (state: RootState) => state.etrade.status;
export const selectSessionId = (state: RootState) => state.etrade.sessionId;
export const selectAuthorizeUrl = (state: RootState) =>
  state.etrade.authorizeUrl;
export const selectAccounts = (state: RootState) => state.etrade.accounts;
export const selectSelectedAccountKey = (state: RootState) =>
  state.etrade.selectedAccountKey;
export const selectPositions = (state: RootState) => state.etrade.positions;
export const selectOrders = (state: RootState) => state.etrade.orders;
export const selectBalance = (state: RootState) => state.etrade.balance;
export const selectLoading = (state: RootState) => state.etrade.loading;
export const selectError = (state: RootState) => state.etrade.error;

export default etradeSlice.reducer;
