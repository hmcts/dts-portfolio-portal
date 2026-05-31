import { getServerApiClient } from "@/lib/api-client-server";
import type { SidebarJurisdiction } from "@/lib/types";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

// Outer layout: fixed-width sidebar on the left, topbar across the top
// of the main column, then scrollable main content. The shell is the
// only place that knows about the chrome — pages render their own
// content into the main slot via Next.js layout composition.
//
// System-status / degradation messages live INSIDE the topbar
// (Topbar reads the health probes and shifts its tone + content
// when degraded), so the shell stays a clean three-piece layout.
//
// The sidebar's jurisdiction list is fetched server-side here and
// passed in as a prop. Sidebar is a client component (it has its
// own `useState` for the expand-chevron state) so it can't fetch
// the data itself.

export async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const api = await getServerApiClient();
  const jurisdictions = await api.get<SidebarJurisdiction[]>("/api/sidebar/jurisdictions");
  return (
    <div className="flex h-dvh w-dvw overflow-hidden bg-[var(--color-canvas)]">
      <Sidebar jurisdictions={jurisdictions} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main
          id="main"
          tabIndex={0}
          aria-label="Main content"
          className="flex-1 overflow-y-auto px-8 py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
