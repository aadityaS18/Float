import { RefreshCw, Bell, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "@/hooks/useAccount";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  title: string;
  insightCount?: number;
}

export function TopBar({ title, insightCount = 0 }: TopBarProps) {
  const navigate = useNavigate();
  const { account } = useAccount();
  const initials = account?.business_name
    ? account.business_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "FL";

  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-4 border-b border-border bg-card/85 backdrop-blur-sm px-6">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      <button
        onClick={() => navigate("/chat")}
        className="mx-auto flex h-9 w-80 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground hover:border-primary/30 transition-colors"
      >
        <Search size={14} />
        Ask Float anything...
      </button>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <RefreshCw size={16} />
        </Button>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell size={16} />
          {insightCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-float-red text-[10px] font-bold text-primary-foreground">
              {insightCount}
            </span>
          )}
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {initials}
        </div>
      </div>
    </header>
  );
}
