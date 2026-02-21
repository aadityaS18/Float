import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Unplug, Link2, LogOut, Trash2, Building2, Users, CreditCard, Calendar, Globe } from "lucide-react";
import { formatCurrency, getCurrencySymbol } from "@/lib/format";

const sectors = ["restaurant", "agency", "clinic", "construction", "retail", "other"];
const frequencies = ["weekly", "biweekly", "monthly"];
const days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const currencies = ["EUR", "GBP", "USD"];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { account, updateAccount } = useAccount();
  const { toast } = useToast();

  const [businessName, setBusinessName] = useState(account?.business_name ?? "");
  const [sector, setSector] = useState(account?.sector ?? "restaurant");
  const [employeeCount, setEmployeeCount] = useState(String(account?.employee_count ?? 0));
  const [payrollAmount, setPayrollAmount] = useState(String((account?.payroll_amount ?? 0) / 100));
  const [payrollFrequency, setPayrollFrequency] = useState(account?.payroll_frequency ?? "biweekly");
  const [payrollDay, setPayrollDay] = useState(account?.payroll_day ?? "friday");
  const [currency, setCurrency] = useState((account as any)?.currency ?? "EUR");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await updateAccount({
      business_name: businessName,
      sector,
      employee_count: parseInt(employeeCount) || 0,
      payroll_amount: Math.round(parseFloat(payrollAmount) * 100) || 0,
      payroll_frequency: payrollFrequency,
      payroll_day: payrollDay,
      currency,
    } as any);
    setSaving(false);
    toast({ title: "Settings saved", description: "Your business details have been updated." });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleDisconnectMonzo = async () => {
    await updateAccount({
      monzo_connected: false,
      monzo_access_token: null,
      monzo_account_id: null,
    });
    toast({ title: "Monzo disconnected", description: "Your Monzo account has been disconnected." });
  };

  return (
    <>
      <TopBar title="Settings" subtitle="Manage your account" />

      <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
        {/* Business Details */}
        <Card className="animate-fade-in-up" style={{ animationDelay: "50ms" }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-primary" />
              <CardTitle className="text-sm font-semibold">Business Details</CardTitle>
            </div>
            <CardDescription className="text-xs">Core information about your business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Business Name</Label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Sector</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Users size={11} /> Employees</Label>
                <Input type="number" value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Globe size={11} /> Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c} value={c}>{c} ({getCurrencySymbol(c)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payroll */}
        <Card className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-primary" />
              <CardTitle className="text-sm font-semibold">Payroll Configuration</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Current payroll: {formatCurrency(account?.payroll_amount ?? 0)} · {account?.payroll_frequency ?? "biweekly"} · {account?.payroll_day ?? "friday"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Payroll Amount (€)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">€</span>
                <Input className="pl-7 font-mono" type="number" value={payrollAmount} onChange={(e) => setPayrollAmount(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Calendar size={11} /> Frequency</Label>
                <Select value={payrollFrequency} onValueChange={setPayrollFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {frequencies.map((f) => (
                      <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payday</Label>
                <Select value={payrollDay} onValueChange={setPayrollDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {days.map((d) => (
                      <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <Button onClick={handleSave} disabled={saving} className="w-full animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <Save size={14} className="mr-2" />
          {saving ? "Saving…" : "Save Changes"}
        </Button>

        {/* Monzo Connection */}
        <Card className="animate-fade-in-up" style={{ animationDelay: "250ms" }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-float-monzo/10">
                  <span className="text-sm font-bold text-float-monzo">M</span>
                </div>
                <CardTitle className="text-sm font-semibold">Monzo Connection</CardTitle>
              </div>
              <Badge variant="outline" className={account?.monzo_connected
                ? "bg-float-green/10 text-float-green border-float-green/20"
                : "bg-muted text-muted-foreground"
              }>
                {account?.monzo_connected ? "Connected" : "Not Connected"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {account?.monzo_connected ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Your Monzo account is connected. Transactions sync automatically.
                </p>
                <Button variant="outline" size="sm" onClick={handleDisconnectMonzo} className="text-float-red hover:text-float-red">
                  <Unplug size={13} className="mr-1.5" /> Disconnect Monzo
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Connect your Monzo account to sync transactions and get real-time balance updates.
                </p>
                <Button size="sm" className="bg-float-monzo hover:bg-float-monzo/90 text-primary-foreground">
                  <Link2 size={13} className="mr-1.5" /> Connect Monzo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Account Actions */}
        <Card className="border-destructive/20 animate-fade-in-up" style={{ animationDelay: "350ms" }}>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Sign Out</p>
                <p className="text-xs text-muted-foreground">Sign out of your Float account</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut size={13} className="mr-1.5" /> Sign Out
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Delete Account</p>
                <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
              </div>
              <Button variant="destructive" size="sm" disabled>
                <Trash2 size={13} className="mr-1.5" /> Delete
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="pb-8 text-center text-[10px] text-muted-foreground">
          Signed in as {user?.email}
        </p>
      </div>
    </>
  );
}
