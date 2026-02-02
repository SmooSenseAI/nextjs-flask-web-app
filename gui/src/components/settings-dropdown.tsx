"use client";

import { Settings, Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
