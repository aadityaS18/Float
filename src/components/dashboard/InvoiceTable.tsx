import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, daysOverdue, getInvoiceStatusColor } from "@/lib/format";
import { Phone, CreditCard, Check } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;

interface InvoiceTableProps {
  invoices: Invoice[];
  onChase: () => void;
  payrollAtRisk: boolean;
}

export function InvoiceTable({ invoices, onChase, payrollAtRisk }: InvoiceTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">Invoices</CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">Upload PDF</Button>
          <Button size="sm">Add Invoice +</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const overdueDays = inv.due_date ? daysOverdue(inv.due_date) : 0;
              const isPayrollResolver = inv.invoice_number === "INV-047" && payrollAtRisk;

              return (
                <TableRow key={inv.id} className={isPayrollResolver ? "bg-float-red/[0.03]" : ""}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground text-sm">{inv.client_name}</p>
                      {isPayrollResolver && (
                        <span className="text-[10px] text-float-red font-medium">Collecting this resolves your payroll crisis</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{inv.invoice_number}</TableCell>
                  <TableCell className="text-right font-mono font-medium tabular-nums">{formatCurrency(inv.amount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.due_date}
                    {overdueDays > 0 && inv.status === "overdue" && (
                      <span className="ml-1 text-float-red font-medium">({overdueDays}d)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-[10px] font-medium ${getInvoiceStatusColor(inv.status ?? "unpaid", inv.due_date)}`}>
                      {inv.status === "paid" && <Check size={10} className="mr-0.5" />}
                      {(inv.status ?? "unpaid").charAt(0).toUpperCase() + (inv.status ?? "unpaid").slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {inv.status === "overdue" && (
                        <Button variant="ghost" size="sm" className="text-float-red text-xs h-7" onClick={onChase}>
                          <Phone size={12} className="mr-1" /> Chase
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-primary text-xs h-7">
                        <CreditCard size={12} className="mr-1" /> Send Link
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No invoices yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
