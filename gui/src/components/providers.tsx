"use client";

import { useRef } from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore } from "@/lib/store";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return (
    <Provider store={storeRef.current}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </Provider>
  );
}
