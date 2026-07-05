import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/movements")({
  component: MovementsPage,
});

const MTYPES = ["issue", "return", "restock", "adjustment"] as const;

const schema = z.object({
  item_id: z.string().uuid(),
  movement_type: z.enum(MTYPES),
  quantity: z.number().int().positive(),
  issued_to: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

function MovementsPage() {
  const qc = useQueryClient();
  const [filterType, setFilterType] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => (await supabase.from("items").select("id, name, unit, quantity").order("name")).data ?? [],
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["movements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_movements").select("*, items(name, unit)").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin-self"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      return !!data;
    },
  });

  const create = useMutation({
    mutationFn: async (v: z.infer<typeof schema>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("stock_movements").insert({
        item_id: v.item_id,
        movement_type: v.movement_type,
        quantity: v.quantity,
        issued_to: v.issued_to || null,
        notes: v.notes || null,
        performed_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      setOpen(false);
      toast.success("Movement recorded");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const filtered = movements.filter((m: any) => filterType === "all" || m.movement_type === filterType);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Stock movements</h1>
          <p className="text-muted-foreground text-sm mt-1">Issue, return, restock and adjust equipment.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New movement</Button></DialogTrigger>
            <MovementDialog items={items} onSubmit={(v) => create.mutate(v)} loading={create.isPending} />
          </Dialog>
        )}
      </div>

      <Card className="p-4">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {MTYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Item</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Qty</th>
                <th className="text-left px-4 py-3">Issued to</th>
                <th className="text-left px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No movements yet.</td></tr>
              )}
              {filtered.map((m: any) => (
                <tr key={m.id} className="border-t">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{m.items?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge(m.movement_type)}`}>{m.movement_type}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{m.quantity} {m.items?.unit}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.issued_to ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function badge(t: string) {
  switch (t) {
    case "issue": return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
    case "return": return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "restock": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function MovementDialog({ items, onSubmit, loading }: { items: any[]; onSubmit: (v: z.infer<typeof schema>) => void; loading: boolean }) {
  const [form, setForm] = useState({
    item_id: "",
    movement_type: "issue" as (typeof MTYPES)[number],
    quantity: 1,
    issued_to: "",
    notes: "",
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New stock movement</DialogTitle></DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = schema.safeParse(form);
          if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
          onSubmit(parsed.data);
        }}
      >
        <div className="space-y-1.5">
          <Label>Item</Label>
          <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
            <SelectTrigger><SelectValue placeholder="Choose an item" /></SelectTrigger>
            <SelectContent>
              {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} (in stock: {i.quantity} {i.unit})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.movement_type} onValueChange={(v) => setForm({ ...form, movement_type: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MTYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </div>
        </div>
        <div className="space-y-1.5"><Label>Issued to (optional)</Label><Input value={form.issued_to} onChange={(e) => setForm({ ...form, issued_to: e.target.value })} placeholder="Student / staff name" /></div>
        <div className="space-y-1.5"><Label>Notes (optional)</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <p className="text-xs text-muted-foreground">
          For "adjustment", quantity sets the new absolute stock value.
        </p>
        <DialogFooter><Button type="submit" disabled={loading}>Record</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
