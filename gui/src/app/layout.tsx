import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { SettingsDropdown } from "@/components/settings-dropdown";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web App",
  description: "Next.js + Flask Web Application",
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
