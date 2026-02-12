import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { SettingsDropdown } from "@/components/settings-dropdown";
import "./globals.css";

export const metadata: Metadata = {
  title: "ITrade",
  description: "ITrade - E*Trade Trading Wrapper",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          <div className="fixed top-4 right-4 z-50">
            <SettingsDropdown />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}
