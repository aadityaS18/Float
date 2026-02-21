import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const benchmarks = [
  { metric: "Invoice Payment Time", you: "34 days", avg: "22 days", gap: "+12 days", status: "red" },
  { metric: "Recurring Cost Ratio", you: "67%", avg: "58%", gap: "+9%", status: "amber" },
  { metric: "Cash Reserve", you: "11 days", avg: "18 days", gap: "-7 days", status: "red" },
  { metric: "Revenue Consistency", you: "72/100", avg: "68/100", gap: "+4 pts", status: "green" },
  { metric: "Outstanding Invoice Ratio", you: "18%", avg: "12%", gap: "+6%", status: "amber" },
  { metric: "Payroll to Revenue", you: "29%", avg: "31%", gap: "-2%", status: "green" },
];

const statusColors: Record<string, string> = {
  red: "text-float-red",
  amber: "text-float-amber",
  green: "text-float-green",
};

const statusIcons: Record<string, string> = {
  red: "🔴",
  amber: "🟡",
  green: "🟢",
};

export function BenchmarkPanel() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">Industry Benchmarks</CardTitle>
        <Badge variant="secondary" className="text-xs">Dublin Restaurants · 6-15 Employees</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead className="text-right">You</TableHead>
              <TableHead className="text-right">Industry Avg</TableHead>
              <TableHead className="text-right">Gap</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {benchmarks.map((b) => (
              <TableRow key={b.metric}>
                <TableCell className="text-sm font-medium">{b.metric}</TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">{b.you}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground tabular-nums">{b.avg}</TableCell>
                <TableCell className={`text-right font-mono text-sm tabular-nums ${statusColors[b.status]}`}>{b.gap}</TableCell>
                <TableCell className="text-center">{statusIcons[b.status]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="px-4 py-3 text-[10px] text-muted-foreground">Benchmarks from anonymised aggregate data across similar businesses.</p>
      </CardContent>
    </Card>
  );
}
