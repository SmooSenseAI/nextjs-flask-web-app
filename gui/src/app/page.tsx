"use client";

import { useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
  selectETradeStatus,
  selectSessionId,
  selectSelectedAccountKey,
  selectPositions,
  selectBalance,
  selectLoading,
  restoreSession,
} from "@/lib/features/etradeSlice";
import { ETradeConnect } from "@/components/etrade-connect";
import { PositionsGrid } from "@/components/positions-grid";

export default function Home() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectETradeStatus);
  const sessionId = useAppSelector(selectSessionId);
  const accountKey = useAppSelector(selectSelectedAccountKey);
  const positions = useAppSelector(selectPositions);
  const balance = useAppSelector(selectBalance);
  const loading = useAppSelector(selectLoading);

  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  return (
    <main className="flex flex-col min-h-screen p-6 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ITrade</h1>
      </div>

      {status === "restoring" ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Restoring session...</p>
        </div>
      ) : status !== "connected" ? (
        <div className="flex-1 flex items-center justify-center">
          <ETradeConnect />
        </div>
      ) : (
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <p className="text-muted-foreground">Loading positions...</p>
            </div>
          ) : positions.length === 0 ? (
            <div className="flex items-center justify-center p-12">
              <p className="text-muted-foreground">
                No positions found in this account.
              </p>
            </div>
          ) : (
            <PositionsGrid positions={positions} balance={balance} sessionId={sessionId ?? ""} accountKey={accountKey ?? ""} />
          )}
        </div>
      )}
    </main>
  );
}
