import { RefreshCw, Bell } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NlQueryBar } from "@/components/dashboard/NlQueryBar";

interface TopBarProps {
  title: string;
  subtitle?: string;
  insightCount?: number;
}

export function TopBar({ title, subtitle, insightCount = 0 }: TopBarProps) {
  const { account } = useAccount();
  const initials = account?.business_name
    ? account.business_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "FL";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-card/95 backdrop-blur-xl px-6 shadow-sm">
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-foreground leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>}
      </div>

      <NlQueryBar />

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <RefreshCw size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh data</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-foreground">
              <Bell size={15} />
              {insightCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {insightCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground transition-transform hover:scale-105">
              {initials}
            </button>
          </TooltipTrigger>
          <TooltipContent>{account?.business_name ?? "Account"}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
