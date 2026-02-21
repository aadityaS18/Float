import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Insight = Tables<"ai_insights">;

interface AiInsightsPanelProps {
  insights: Insight[];
  onDismiss: (id: string) => void;
  onAction: (type: string) => void;
}

const borderColors: Record<string, string> = {
  critical: "border-l-float-red",
  warning: "border-l-float-amber",
  info: "border-l-primary",
  opportunity: "border-l-float-green",
};

export function AiInsightsPanel({ insights, onDismiss, onAction }: AiInsightsPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          Float AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`relative rounded-lg border border-border border-l-[3px] ${borderColors[insight.type] ?? "border-l-primary"} bg-accent/30 p-4 transition-all`}
          >
            <button
              onClick={() => onDismiss(insight.id)}
              className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
            <h4 className="text-sm font-semibold text-foreground pr-6">{insight.title}</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.message}</p>
            {insight.action_label && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs text-primary"
                onClick={() => onAction(insight.action_type ?? "")}
              >
                {insight.action_label}
              </Button>
            )}
          </div>
        ))}
        {insights.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No active insights</p>
        )}
      </CardContent>
    </Card>
  );
}
