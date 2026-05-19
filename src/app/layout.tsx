import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "DTS Portfolio Portal",
  description:
    "A high-level front door over Ardoq / Jira / Confluence for HMCTS DTS.",
};

export const viewport: Viewport = {
  themeColor: "#faf9f5",
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
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
