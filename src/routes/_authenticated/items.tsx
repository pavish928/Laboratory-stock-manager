import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/items")({
  component: ItemsPage,
});

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  unit: z.string().trim().min(1).max(20),
  quantity: z.number().int().min(0),
  low_stock_threshold: z.number().int().min(0),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
type ItemInput = z.infer<typeof itemSchema>;

function ItemsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").order("name");
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

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))).sort(), [items]);

  const filtered = items.filter((i) => {
    const matchQ = !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.location ?? "").toLowerCase().includes(search.toLowerCase());
    const matchC = category === "all" || i.category === category;
    return matchQ && matchC;
  });

  const upsert = useMutation({
    mutationFn: async (payload: ItemInput & { id?: string }) => {
      const parsed = itemSchema.parse(payload);
      const row = { ...parsed, location: parsed.location || null, description: parsed.description || null };
      if (payload.id) {
        const { error } = await supabase.from("items").update(row).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("items").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      setOpen(false);
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Items</h1>
          <p className="text-muted-foreground text-sm mt-1">Master list of lab equipment and consumables.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add item</Button>
            </DialogTrigger>
            <ItemDialog editing={editing} onSubmit={(v) => upsert.mutate({ ...v, id: editing?.id })} loading={upsert.isPending} />
          </Dialog>
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name or location…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-right px-4 py-3">Quantity</th>
                <th className="text-right px-4 py-3">Threshold</th>
                <th className="text-left px-4 py-3">Location</th>
                {isAdmin && <th className="w-24"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No items match.</td></tr>
              )}
              {filtered.map((i) => {
                const low = i.quantity <= i.low_stock_threshold;
                return (
                  <tr key={i.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{i.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.category}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${low ? "text-destructive" : ""}`}>{i.quantity} {i.unit}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{i.low_stock_threshold}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.location ?? "—"}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button className="p-1.5 hover:text-primary" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-4 w-4" /></button>
                        <button className="p-1.5 hover:text-destructive" onClick={() => { if (confirm(`Delete "${i.name}"?`)) del.mutate(i.id); }}><Trash2 className="h-4 w-4" /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ItemDialog({ editing, onSubmit, loading }: { editing: any; onSubmit: (v: ItemInput) => void; loading: boolean }) {
  const [form, setForm] = useState<ItemInput>(() => ({
    name: editing?.name ?? "",
    category: editing?.category ?? "General",
    unit: editing?.unit ?? "pcs",
    quantity: editing?.quantity ?? 0,
    low_stock_threshold: editing?.low_stock_threshold ?? 5,
    location: editing?.location ?? "",
    description: editing?.description ?? "",
  }));

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit item" : "Add item"}</DialogTitle></DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = itemSchema.safeParse(form);
          if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
          onSubmit(parsed.data);
        }}
      >
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required /></Field>
          <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity"><Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></Field>
          <Field label="Low-stock threshold"><Input type="number" min={0} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Location"><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
        <Field label="Description"><Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <DialogFooter>
          <Button type="submit" disabled={loading}>{editing ? "Save changes" : "Create item"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
