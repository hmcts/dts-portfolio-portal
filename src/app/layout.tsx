import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "DTS Portfolio Portal",
  description:
    "A high-level front door over Ardoq / Jira / Confluence for HMCTS DTS.",
};

export const viewport: Viewport = {
  // Matches --color-canvas — mobile browser chrome tints to the
  // page canvas. Prototype renders pure white, not the original
  // warm-stone cream. See globals.css for the token rationale.
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-GB"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
