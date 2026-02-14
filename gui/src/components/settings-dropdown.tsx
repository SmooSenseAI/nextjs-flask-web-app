"use client";

import { Settings, Sun, Moon, Monitor, LogOut } from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import {
  selectETradeStatus,
  selectAccounts,
  selectSelectedAccountKey,
  selectSessionId,
  selectAccount,
  fetchPositions,
  fetchBalance,
  fetchOrders,
  logoutSession,
} from "@/lib/features/etradeSlice";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: { value: Theme; icon: React.ReactNode }[] = [
    { value: "light", icon: <Sun className="h-4 w-4" /> },
    { value: "system", icon: <Monitor className="h-4 w-4" /> },
    { value: "dark", icon: <Moon className="h-4 w-4" /> },
  ];

  return (
    <div className="flex items-center gap-1 rounded-md bg-muted p-1">
      {options.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          size="icon"
          onClick={() => setTheme(option.value)}
          className={cn(
            "h-7 w-7",
            theme === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-transparent"
          )}
        >
          {option.icon}
        </Button>
      ))}
    </div>
  );
}

export function SettingsDropdown() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectETradeStatus);
  const accounts = useAppSelector(selectAccounts);
  const selectedAccountKey = useAppSelector(selectSelectedAccountKey);
  const sessionId = useAppSelector(selectSessionId);

  const handleAccountChange = (accountKey: string) => {
    dispatch(selectAccount(accountKey));
    if (sessionId) {
      dispatch(fetchPositions({ sessionId, accountKey }));
      dispatch(fetchBalance({ sessionId, accountKey }));
      dispatch(fetchOrders({ sessionId, accountKey }));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="flex items-center gap-4 px-2 py-1.5">
          <span className="text-sm whitespace-nowrap">Theme</span>
          <ThemeToggle />
        </div>
        {status === "connected" && accounts.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center gap-4 px-2 py-1.5">
              <span className="text-sm whitespace-nowrap">Account</span>
              <select
                value={selectedAccountKey || ""}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="px-2 py-1 border rounded-md bg-background text-foreground text-sm"
              >
                {accounts.map((acct) => (
                  <option key={acct.accountIdKey} value={acct.accountIdKey}>
                    {acct.accountDesc || acct.accountId} (...{acct.accountId.slice(-4)})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        {status === "connected" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => dispatch(logoutSession())}>
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect E*Trade
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
