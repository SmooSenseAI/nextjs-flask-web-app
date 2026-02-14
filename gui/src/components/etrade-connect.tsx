"use client";

import { useState } from "react";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
  selectETradeStatus,
  selectSessionId,
  selectAuthorizeUrl,
  selectLoading,
  selectError,
  requestToken,
  exchangeAccessToken,
} from "@/lib/features/etradeSlice";
import { Button } from "@/components/ui/button";

export function ETradeConnect() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectETradeStatus);
  const sessionId = useAppSelector(selectSessionId);
  const authorizeUrl = useAppSelector(selectAuthorizeUrl);
  const loading = useAppSelector(selectLoading);
  const error = useAppSelector(selectError);

  const [verifierCode, setVerifierCode] = useState("");

  const handleConnect = async () => {
    const result = await dispatch(requestToken()).unwrap();
    window.open(result.authorizeUrl, "_blank");
  };

  const handleVerify = () => {
    if (!sessionId || !verifierCode.trim()) return;
    dispatch(
      exchangeAccessToken({ sessionId, verifierCode: verifierCode.trim() }),
    );
  };

  if (status === "disconnected") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 border rounded-lg bg-secondary">
        <h2 className="text-xl font-semibold">E*Trade Portfolio</h2>
        <p className="text-muted-foreground text-sm">
          Connect your E*Trade account to view positions
        </p>
        <Button onClick={handleConnect} disabled={loading}>
          {loading ? "Connecting..." : "Connect to E*Trade"}
        </Button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    );
  }

  if (status === "awaiting_code" || status === "authenticating") {
    return (
      <div className="flex flex-col items-center gap-4 p-8 border rounded-lg bg-secondary">
        <h2 className="text-xl font-semibold">Enter Verification Code</h2>
        <p className="text-muted-foreground text-sm text-center max-w-md">
          A new tab has opened with the E*Trade authorization page. After
          authorizing, enter the verification code below.
        </p>
        {authorizeUrl && (
          <a
            href={authorizeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            Open authorization page again
          </a>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={verifierCode}
            onChange={(e) => setVerifierCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder="Verification code"
            className="px-3 py-2 border rounded-md bg-background text-foreground text-sm w-48"
            disabled={status === "authenticating"}
          />
          <Button
            onClick={handleVerify}
            disabled={
              !verifierCode.trim() || status === "authenticating"
            }
          >
            {status === "authenticating" ? "Verifying..." : "Verify"}
          </Button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    );
  }

  return null;
}
