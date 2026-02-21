import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, daysOverdue, getInvoiceStatusColor } from "@/lib/format";
import { Phone, CreditCard, Check, FileText, Plus } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;

interface InvoiceTableProps {
  invoices: Invoice[];
  onChase: () => void;
  payrollAtRisk: boolean;
}

export function InvoiceTable({ invoices, onChase, payrollAtRisk }: InvoiceTableProps) {
  const sorted = [...invoices].sort((a, b) => {
    const order: Record<string, number> = { overdue: 0, chasing: 1, unpaid: 2, upcoming: 3, paid: 4 };
    return (order[a.status ?? "unpaid"] ?? 2) - (order[b.status ?? "unpaid"] ?? 2);
  });

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">Invoices</CardTitle>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <FileText size={12} className="mr-1" /> Upload
          </Button>
          <Button size="sm" className="h-7 text-xs">
            <Plus size={12} className="mr-1" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No invoices yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Add invoices or load demo data</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px]">Client</TableHead>
                <TableHead className="text-[10px] text-right">Amount</TableHead>
                <TableHead className="text-[10px]">Due</TableHead>
                <TableHead className="text-[10px]">Status</TableHead>
                <TableHead className="text-[10px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((inv) => {
                const overdueDays = inv.due_date ? daysOverdue(inv.due_date) : 0;
                const isResolver = inv.invoice_number === "INV-047" && payrollAtRisk;

                return (
                  <TableRow key={inv.id} className={`group ${isResolver ? "bg-float-red/[0.03]" : ""}`}>
                    <TableCell className="py-3">
                      <p className="text-sm font-medium text-foreground">{inv.client_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {inv.invoice_number}
                        {isResolver && <span className="ml-1 text-float-red font-medium">· Resolves payroll crisis</span>}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 text-right font-mono text-sm font-semibold tabular-nums">
                      {formatCurrency(inv.amount)}
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-xs text-muted-foreground">
                        {inv.due_date ? format(new Date(inv.due_date), "MMM d") : "—"}
                      </span>
                      {overdueDays > 0 && inv.status === "overdue" && (
                        <span className="ml-1 text-[10px] font-medium text-float-red">+{overdueDays}d</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="secondary" className={`text-[10px] font-medium ${getInvoiceStatusColor(inv.status ?? "unpaid", inv.due_date)}`}>
                        {inv.status === "paid" && <Check size={9} className="mr-0.5" />}
                        {(inv.status ?? "unpaid").charAt(0).toUpperCase() + (inv.status ?? "unpaid").slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {inv.status === "overdue" && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-float-red" onClick={onChase}>
                            <Phone size={11} className="mr-0.5" /> Chase
                          </Button>
                        )}
                        {inv.status !== "paid" && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-primary">
                            <CreditCard size={11} className="mr-0.5" /> Link
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
