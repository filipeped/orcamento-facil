import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getSupabase } from "@/lib/supabase";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface Coupon {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number | null;
  current_uses: number;
  valid_until: string | null;
  plans: string[];
  active: boolean;
  created_at: string;
}

export default function AdminCupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    discount_percent: 10,
    max_uses: "",
    valid_until: "",
    plans: ["essential", "pro"] as string[],
    active: true,
  });

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      const { data, error } = await getSupabase()
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error("Error loading coupons:", error);
      toast.error("Erro ao carregar cupons");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      discount_percent: 10,
      max_uses: "",
      valid_until: "",
      plans: ["essential", "pro"],
      active: true,
    });
    setEditingCoupon(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discount_percent: coupon.discount_percent,
      max_uses: coupon.max_uses?.toString() || "",
      valid_until: coupon.valid_until?.split("T")[0] || "",
      plans: coupon.plans || ["essential", "pro"],
      active: coupon.active,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.code) {
      toast.error("Codigo do cupom e obrigatorio");
      return;
    }

    try {
      const couponData = {
        code: formData.code.toUpperCase(),
        discount_percent: formData.discount_percent,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        valid_until: formData.valid_until || null,
        plans: formData.plans,
        active: formData.active,
      };

      if (editingCoupon) {
        const { error } = await getSupabase()
          .from("coupons")
          .update(couponData)
          .eq("id", editingCoupon.id);

        if (error) throw error;
        toast.success("Cupom atualizado");
      } else {
        const { error } = await getSupabase()
          .from("coupons")
          .insert([couponData]);

        if (error) {
          if (error.code === "23505") {
            toast.error("Ja existe um cupom com este codigo");
            return;
          }
          throw error;
        }
        toast.success("Cupom criado");
      }

      setShowModal(false);
      loadCoupons();
    } catch (error) {
      console.error("Error saving coupon:", error);
      toast.error("Erro ao salvar cupom");
    }
  };

  const handleDelete = async () => {
    if (!couponToDelete) return;

    try {
      const { error } = await getSupabase()
        .from("coupons")
        .delete()
        .eq("id", couponToDelete.id);

      if (error) throw error;
      toast.success("Cupom excluido");
      setShowDeleteModal(false);
      loadCoupons();
    } catch (error) {
      console.error("Error deleting coupon:", error);
      toast.error("Erro ao excluir cupom");
    }
  };

  const togglePlan = (plan: string) => {
    setFormData((prev) => ({
      ...prev,
      plans: prev.plans.includes(plan)
        ? prev.plans.filter((p) => p !== plan)
        : [...prev.plans, plan],
    }));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Codigo copiado!");
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Cupons</h1>
            <p className="text-neutral-500">{coupons.length} cupons cadastrados</p>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Cupom
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-neutral-50 border-b">
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">
                    Codigo
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">
                    Desconto
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">
                    Usos
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">
                    Validade
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">
                    Planos
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">
                    Status
                  </th>
                  <th className="text-right text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-medium text-neutral-900 bg-neutral-100 px-2 py-1 rounded">
                          {coupon.code}
                        </code>
                        <button
                          onClick={() => copyCode(coupon.code)}
                          className="text-neutral-400 hover:text-neutral-600"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-emerald-600">
                        {coupon.discount_percent}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-600">
                        {coupon.current_uses}
                        {coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-600">
                        {formatDate(coupon.valid_until)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {coupon.plans?.map((plan) => (
                          <Badge key={plan} variant="outline" className="text-xs">
                            {plan === "essential" ? "Mensal" : plan === "pro" ? "Anual" : plan}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        className={
                          coupon.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-neutral-100 text-neutral-600"
                        }
                      >
                        {coupon.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(coupon)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCouponToDelete(coupon);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {coupons.length === 0 && (
            <div className="text-center py-12">
              <p className="text-neutral-500">Nenhum cupom cadastrado</p>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCoupon ? "Editar Cupom" : "Novo Cupom"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="code">Codigo</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="PROMO50"
                  className="uppercase"
                />
              </div>

              <div>
                <Label htmlFor="discount">Desconto (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.discount_percent}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      discount_percent: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="max_uses">Limite de Usos (vazio = ilimitado)</Label>
                <Input
                  id="max_uses"
                  type="number"
                  min="1"
                  value={formData.max_uses}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, max_uses: e.target.value }))
                  }
                  placeholder="Ilimitado"
                />
              </div>

              <div>
                <Label htmlFor="valid_until">Validade (vazio = sem validade)</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, valid_until: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label>Planos Validos</Label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.plans.includes("essential")}
                      onCheckedChange={() => togglePlan("essential")}
                    />
                    <span className="text-sm">Mensal</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.plans.includes("pro")}
                      onCheckedChange={() => togglePlan("pro")}
                    />
                    <span className="text-sm">Anual</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="active">Cupom Ativo</Label>
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, active: checked }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>
                {editingCoupon ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir Cupom</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir o cupom{" "}
                <strong>{couponToDelete?.code}</strong>? Esta acao nao pode ser
                desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
