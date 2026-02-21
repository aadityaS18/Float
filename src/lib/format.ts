export function formatCurrency(pence: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(pence / 100);
}

export function formatCurrencyShort(pence: number): string {
  const euros = pence / 100;
  if (euros >= 1000) {
    return `€${(euros / 1000).toFixed(1)}k`;
  }
  return `€${euros.toFixed(0)}`;
}

export function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function getInvoiceStatusColor(status: string, dueDate?: string | null): string {
  if (status === "paid") return "text-float-green bg-float-green/10";
  if (status === "chasing") return "text-float-amber bg-float-amber/10";
  if (status === "overdue") {
    const days = dueDate ? daysOverdue(dueDate) : 0;
    return days > 14
      ? "text-float-red bg-float-red/10"
      : "text-float-amber bg-float-amber/10";
  }
  if (status === "unpaid") return "text-primary bg-primary/10";
  return "text-muted-foreground bg-muted";
}
