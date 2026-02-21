import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { formatCurrency, daysOverdue, getInvoiceStatusColor } from "@/lib/format";
import { Phone, CreditCard, Check, FileText, Plus, Pencil, Save, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { InvoiceUploadDialog } from "./InvoiceUploadDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;

interface InvoiceTableProps {
  invoices: Invoice[];
  onChase: () => void;
  onRefresh?: () => void;
  payrollAtRisk: boolean;
}

export function InvoiceTable({ invoices, onChase, onRefresh, payrollAtRisk }: InvoiceTableProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const sorted = [...invoices].sort((a, b) => {
    const order: Record<string, number> = { overdue: 0, chasing: 1, unpaid: 2, upcoming: 3, paid: 4 };
    return (order[a.status ?? "unpaid"] ?? 2) - (order[b.status ?? "unpaid"] ?? 2);
  });

  const startEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setEditPhone(inv.client_phone ?? "");
  };

  const savePhone = async (id: string) => {
    const { error } = await supabase
      .from("invoices")
      .update({ client_phone: editPhone.trim() })
      .eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save phone number" });
    } else {
      toast({ title: "Saved", description: "Phone number updated" });
      onRefresh?.();
    }
    setEditingId(null);
  };

  const handleChase = (inv: Invoice) => {
    if (!inv.client_phone) {
      toast({ variant: "destructive", title: "No phone number", description: "Add a phone number first by clicking the pencil icon" });
      return;
    }
    navigate("/calls", { state: { autoCallInvoice: inv } });
  };

  const paidCount = invoices.filter((i) => i.status === "paid").length;
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <FileText size={14} className="text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Invoices</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              {invoices.length} total · {paidCount} paid
              {overdueCount > 0 && <span className="text-float-red font-medium"> · {overdueCount} overdue</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setUploadOpen(true)}>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Client</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Phone</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-right">Amount</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Due</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((inv) => {
                  const overdueDays = inv.due_date ? daysOverdue(inv.due_date) : 0;
                  const isResolver = inv.invoice_number === "INV-047" && payrollAtRisk;
                  const isEditing = editingId === inv.id;

                  return (
                    <TableRow
                      key={inv.id}
                      className={`group transition-colors ${
                        isResolver
                          ? "bg-float-red/[0.02] hover:bg-float-red/[0.04]"
                          : "hover:bg-accent/30"
                      }`}
                    >
                      <TableCell className="py-3.5">
                        <p className="text-sm font-medium text-foreground">{inv.client_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {inv.invoice_number}
                          {isResolver && <span className="ml-1.5 text-float-red font-semibold">· Resolves crisis</span>}
                        </p>
                      </TableCell>
                      <TableCell className="py-3.5">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              placeholder="+44..."
                              className="h-7 w-28 text-xs"
                              onKeyDown={(e) => e.key === "Enter" && savePhone(inv.id)}
                              autoFocus
                            />
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => savePhone(inv.id)}>
                              <Save size={12} />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-muted-foreground tabular-nums">
                              {inv.client_phone || "—"}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => startEdit(inv)}
                            >
                              <Pencil size={10} />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5 text-right font-mono text-sm font-semibold tabular-nums">
                        {formatCurrency(inv.amount)}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span className="text-xs text-muted-foreground">
                          {inv.due_date ? format(new Date(inv.due_date), "MMM d") : "—"}
                        </span>
                        {overdueDays > 0 && inv.status === "overdue" && (
                          <span className="ml-1 text-[10px] font-semibold text-float-red">+{overdueDays}d</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Badge variant="secondary" className={`text-[10px] font-medium ${getInvoiceStatusColor(inv.status ?? "unpaid", inv.due_date)}`}>
                          {inv.status === "paid" && <Check size={9} className="mr-0.5" />}
                          {(inv.status ?? "unpaid").charAt(0).toUpperCase() + (inv.status ?? "unpaid").slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3.5 text-right">
                        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {inv.status === "overdue" && (
                            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[10px] font-medium text-float-red hover:text-float-red hover:bg-float-red/5" onClick={() => handleChase(inv)}>
                              <Phone size={11} className="mr-1" /> Chase
                            </Button>
                          )}
                          {inv.status !== "paid" && (
                            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[10px] font-medium text-primary hover:bg-primary/5">
                              <CreditCard size={11} className="mr-1" /> Link
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <InvoiceUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => onRefresh?.()}
      />
    </Card>
  );
}
