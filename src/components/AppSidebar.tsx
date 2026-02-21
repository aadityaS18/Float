import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Phone, AlertTriangle, Settings, RefreshCw } from "lucide-react";
import { FloatLogo } from "./FloatLogo";
import { useAccount } from "@/hooks/useAccount";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "AI Chat", icon: MessageSquare },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/incidents", label: "Incidents", icon: AlertTriangle },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { account } = useAccount();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      <div className="p-5">
        <FloatLogo />
        {account && (
          <p className="mt-2 text-xs text-muted-foreground truncate">
            {account.business_name}
          </p>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${account?.monzo_connected ? "bg-float-green" : "bg-float-red"}`} />
          <span className="text-xs text-muted-foreground">
            {account?.monzo_connected ? "Monzo Connected" : "Reconnect Monzo"}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <span>Synced 2m ago</span>
          <button className="ml-auto rounded p-0.5 hover:bg-accent">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>
    </aside>
  );
}
