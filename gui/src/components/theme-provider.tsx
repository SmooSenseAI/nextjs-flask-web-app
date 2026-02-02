"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { type ComponentProps } from "react";

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export { useTheme };
