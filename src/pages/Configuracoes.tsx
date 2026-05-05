import { useState, useEffect, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { getSupabase, supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useProposals } from "@/contexts/ProposalsContext";
import {
  CreditCard,
  Settings,
  Palette,
  Camera,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Receipt,
  ExternalLink,
  Upload,
  Trash2,
  FileText,
  Image,
  MapPin,
  Instagram,
  AlignLeft,
  Leaf,
  Check,
  Plus,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const NOTIFICATIONS_STORAGE_KEY = "fechaqui_notifications";
const ACTIVE_TAB_STORAGE_KEY = "fechaqui_settings_tab";
const PROPOSAL_SETTINGS_STORAGE_KEY = "fechaqui_proposal_settings";

interface ProposalSettings {
  showLogo: boolean;
  showCnpj: boolean;
  showAddress: boolean;
  showInstagram: boolean;
  showBio: boolean;
  primaryColor: string;
  footerText: string;
  paymentTerms: string;
  generalTerms: string;
}

const defaultProposalSettings: ProposalSettings = {
  showLogo: true,
  showCnpj: true,
  showAddress: true,
  showInstagram: true,
  showBio: true,
  primaryColor: "#10b981",
  footerText: "",
  paymentTerms: "• 50% no fechamento do contrato\n• 50% na conclusão do serviço\n• Formas: transferência ou dinheiro",
  generalTerms: "• Garantia de 30 dias após a conclusão do serviço\n• Materiais inclusos conforme especificado acima\n• Prazo de execução a combinar após aprovação",
};

interface NotificationSettings {
  proposalViewed: boolean;
  proposalApproved: boolean;
  serviceReminder: boolean;
}

const defaultNotifications: NotificationSettings = {
  proposalViewed: true,
  proposalApproved: true,
  serviceReminder: true,
};

// Mock payment history (in production, this would come from Supabase)
interface Payment {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  plan: string;
  invoiceUrl?: string;
}

const mockPayments: Payment[] = [
  // Empty for free plan users - payments will appear when they subscribe
];

export default function Configuracoes() {
  const { user } = useAuth();
  const { monthlyProposalsCount, monthlyLimit, userPlan } = useProposals();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [payments, setPayments] = useState<Payment[]>(mockPayments);
  const [clientsCount, setClientsCount] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const [planPeriod, setPlanPeriod] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && ["proposal", "account", "billing"].includes(tabFromUrl)) {
      return tabFromUrl;
    }
    return localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) || "proposal";
  });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Image crop states
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Function to create cropped image
  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = imageSrc;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d context");

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas is empty"));
      }, "image/jpeg", 0.95);
    });
  };

  // Function to load existing logo for editing
  const handleEditLogo = async () => {
    if (!logoUrl) return;

    try {
      // Fetch the image and convert to base64 to avoid CORS issues
      const response = await fetch(logoUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setShowCropModal(true);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error loading logo for edit:", error);
      toast.error("Erro ao carregar logo para edição");
    }
  };

  // Sync tab with URL params (for tour navigation)
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && ["proposal", "account", "billing"].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Persist active tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, value);
  };

  // Fetch clients count
  const fetchClientsCount = async () => {
    if (!user) return;
    try {
      const { count } = await getSupabase()
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      setClientsCount(count || 0);
    } catch (error) {
      console.error("Error fetching clients count:", error);
    }
  };

  // Fetch payment history from Supabase
  const fetchPayments = async () => {
    if (!user) return;
    try {
      const { data, error } = await getSupabase()
        .from("payment_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        setPayments(data.map(p => ({
          id: p.id,
          date: p.paid_at || p.created_at,
          amount: p.amount,
          status: p.status === "paid" ? "paid" : p.status === "pending" ? "pending" : "failed",
          plan: userPlan === "essential" ? "Mensal" : userPlan === "pro" ? "Anual" : "Grátis",
          invoiceUrl: p.invoice_url || undefined,
        })));
      }
    } catch (error) {
      // Table might not exist yet - that's okay
      console.log("Payment history not available:", error);
    }
  };

  // Profile state
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [originalPhone, setOriginalPhone] = useState<string | null>(null);

  // Company state
  const [company, setCompany] = useState({
    name: "",
    cnpj: "",
    address: "",
    instagram: "",
    bio: "",
  });

  // Password state
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);

  // Notifications (localStorage)
  const [notifications, setNotifications] = useState<NotificationSettings>(() => {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return defaultNotifications;
      }
    }
    return defaultNotifications;
  });

  // Proposal settings (Supabase)
  const [proposalSettings, setProposalSettings] = useState<ProposalSettings>(defaultProposalSettings);

  // Template de PDF (localStorage — não vai pro banco compartilhado com Jardinei)
  const [pdfTemplate, setPdfTemplate] = useState<"classic" | "modern" | "minimal">(() => {
    try {
      const v = localStorage.getItem("fechaqui_pdf_template");
      if (v === "classic" || v === "modern" || v === "minimal") return v;
    } catch { /* ignore */ }
    return "classic";
  });

  // Fetch proposal settings from Supabase
  const fetchProposalSettings = async () => {
    if (!user) return;

    console.log("Fetching proposal settings for user:", user.id);

    try {
      const { data, error } = await getSupabase()
        .from("proposal_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      console.log("Proposal settings result:", { data, error });

      if (error) throw error;

      if (data) {
        console.log("Setting proposal settings:", data);
        setProposalSettings({
          showLogo: data.show_logo ?? true,
          showCnpj: data.show_cnpj ?? true,
          showAddress: data.show_address ?? true,
          showInstagram: data.show_instagram ?? true,
          showBio: data.show_bio ?? true,
          primaryColor: data.primary_color || "#10b981",
          footerText: data.footer_text || "",
          paymentTerms: data.payment_terms || defaultProposalSettings.paymentTerms,
          generalTerms: data.general_terms || defaultProposalSettings.generalTerms,
        });
      }
    } catch (error) {
      console.error("Error fetching proposal settings:", error);
    }
  };

  // Fetch profile from Supabase
  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await getSupabase()
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setProfile({
          name: data.full_name || user.name || "",
          email: user.email || "",
          phone: data.phone || "",
        });
        setOriginalPhone(data.phone || "");
        setCompany({
          name: data.company_name || "",
          cnpj: data.cnpj || "",
          address: data.address || "",
          instagram: data.instagram || "",
          bio: data.bio || "",
        });
        setLogoUrl(data.logo_url || null);
        setAvatarUrl(data.avatar_url || null);
        setPlanStatus(data.plan_status || null);
        setPlanExpiresAt(data.plan_expires_at || null);
        setPlanPeriod(data.plan_period || null);

        // Calcular dias restantes
        if (data.plan_expires_at) {
          const expiresAt = new Date(data.plan_expires_at);
          const diffDays = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          setDaysRemaining(Math.max(0, diffDays));
          setNextBillingDate(expiresAt.toISOString());
        }
      } else {
        // Use user data if no profile exists
        setProfile({
          name: user.name || "",
          email: user.email || "",
          phone: "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      // Fallback to user data
      setProfile({
        name: user.name || "",
        email: user.email || "",
        phone: "",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize profile with user data from context immediately
  useEffect(() => {
    if (user) {
      setProfile(prev => ({
        ...prev,
        name: prev.name || user.name || "",
        email: prev.email || user.email || "",
      }));
    }
  }, [user]);

  // Fetch additional data in background
  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchClientsCount();
      fetchPayments();
      fetchProposalSettings();
    }
  }, [user]);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d)(\d{4})$/, "$1-$2");
    }
    return value;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }

    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/logo.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await getSupabase().storage
        .from("logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = getSupabase().storage
        .from("logos")
        .getPublicUrl(fileName);

      const newLogoUrl = urlData.publicUrl + "?t=" + Date.now();

      // Update profile with logo URL
      await getSupabase()
        .from("profiles")
        .upsert({ user_id: user.id, logo_url: newLogoUrl }, { onConflict: "user_id" });

      setLogoUrl(newLogoUrl);
      toast.success("Logo atualizado com sucesso!");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Erro ao fazer upload do logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleCropAndUpload = async () => {
    if (!imageToCrop || !croppedAreaPixels || !user) return;

    setIsUploadingLogo(true);
    setShowCropModal(false);

    try {
      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const fileName = `${user.id}/logo.jpg`;

      // Upload to storage
      const { error: uploadError } = await getSupabase().storage
        .from("logos")
        .upload(fileName, croppedBlob, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = getSupabase().storage
        .from("logos")
        .getPublicUrl(fileName);

      const newLogoUrl = urlData.publicUrl + "?t=" + Date.now();

      // Update profile with logo URL
      await getSupabase()
        .from("profiles")
        .upsert({ user_id: user.id, logo_url: newLogoUrl }, { onConflict: "user_id" });

      setLogoUrl(newLogoUrl);
      toast.success("Logo atualizado com sucesso!");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Erro ao fazer upload do logo");
    } finally {
      setIsUploadingLogo(false);
      setImageToCrop(null);
    }
  };

  const handleRemoveLogo = async () => {
    if (!user) return;

    setIsUploadingLogo(true);
    try {
      // Remove from storage
      await getSupabase().storage.from("logos").remove([`${user.id}/logo.png`, `${user.id}/logo.jpg`, `${user.id}/logo.jpeg`]);

      // Update profile
      await getSupabase()
        .from("profiles")
        .update({ logo_url: null })
        .eq("user_id", user.id);

      setLogoUrl(null);
      toast.success("Logo removido!");
    } catch (error) {
      console.error("Error removing logo:", error);
      toast.error("Erro ao remover logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await getSupabase().storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = getSupabase().storage
        .from("avatars")
        .getPublicUrl(fileName);

      const newAvatarUrl = urlData.publicUrl + "?t=" + Date.now();

      await getSupabase()
        .from("profiles")
        .upsert({ user_id: user.id, avatar_url: newAvatarUrl }, { onConflict: "user_id" });

      setAvatarUrl(newAvatarUrl);
      toast.success("Foto atualizada!");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Erro ao fazer upload da foto");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!user) return;

    console.log("Saving company data:", company);

    setIsSaving(true);
    try {
      const { data, error } = await getSupabase()
        .from("profiles")
        .upsert({
          user_id: user.id,
          company_name: company.name,
          cnpj: company.cnpj,
          address: company.address,
          instagram: company.instagram,
          bio: company.bio,
        }, { onConflict: "user_id" })
        .select();

      console.log("Save company result:", { data, error });

      if (error) throw error;

      toast.success("Dados da empresa atualizados!");
    } catch (error) {
      console.error("Error saving company:", error);
      toast.error("Erro ao salvar dados da empresa.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = () => {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    toast.success("Preferencias de notificacao salvas!");
  };

  const handleSaveProposalSettings = async () => {
    if (!user) return;

    setIsSavingStyle(true);
    try {
      // Salvar dados da empresa + nome + telefone
      await getSupabase()
        .from("profiles")
        .upsert({
          user_id: user.id,
          full_name: profile.name,
          company_name: company.name,
          cnpj: company.cnpj,
          address: company.address,
          instagram: company.instagram,
          bio: company.bio,
          phone: profile.phone,
        }, { onConflict: "user_id" });

      // Salvar estilo do orçamento
      await getSupabase()
        .from("proposal_settings")
        .upsert({
          user_id: user.id,
          show_logo: proposalSettings.showLogo,
          show_cnpj: proposalSettings.showCnpj,
          show_address: proposalSettings.showAddress,
          show_instagram: proposalSettings.showInstagram,
          show_bio: proposalSettings.showBio,
          primary_color: proposalSettings.primaryColor,
          footer_text: proposalSettings.footerText,
          payment_terms: proposalSettings.paymentTerms,
          general_terms: proposalSettings.generalTerms,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      // 📱 Enviar mensagem de boas-vindas se telefone foi cadastrado pela primeira vez
      const phoneWasEmpty = !originalPhone || originalPhone.trim() === "";
      const phoneIsNowFilled = profile.phone && profile.phone.trim().length >= 10;

      if (phoneWasEmpty && phoneIsNowFilled) {
        try {
          await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: "whatsapp",
              to: profile.phone,
              type: "welcome",
              data: { name: profile.name?.split(" ")[0] || "Cliente" },
            }),
          });
          setOriginalPhone(profile.phone); // Atualizar para não enviar de novo
        } catch (err) {
          console.error("Erro ao enviar boas-vindas:", err);
        }
      }

      // Atualizar cache do tracking com dados atualizados do profile
      try {
        const trackingData: Record<string, string> = {};
        if (user.email) trackingData.email = user.email;
        if (profile.phone) trackingData.phone = profile.phone;
        if (profile.name) trackingData.full_name = profile.name;
        localStorage.setItem('fechaqui_profile_tracking', JSON.stringify(trackingData));
      } catch { /* ignore */ }

      toast.success("Configurações salvas!");
      // Animação de refresh - tela branca brevemente
      setIsRefreshing(true);
      setTimeout(() => {
        setIsRefreshing(false);
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 2000);
      }, 400);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setIsSavingStyle(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (passwords.new.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres");
      return;
    }

    if (passwords.new !== passwords.confirm) {
      toast.error("As senhas não coincidem");
      return;
    }

    setIsSaving(true);
    try {
      // Primeiro verifica a senha atual fazendo login
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: passwords.current,
      });

      if (loginError) {
        toast.error("Senha atual incorreta");
        setIsSaving(false);
        return;
      }

      // Agora altera a senha
      const { error } = await supabase.auth.updateUser({
        password: passwords.new,
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Erro ao alterar senha. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "EXCLUIR") {
      toast.error("Digite EXCLUIR para confirmar");
      return;
    }

    if (!user) return;

    setIsDeleting(true);
    try {
      // Chamar API server-side para deletar tudo (incluindo usuário do Auth)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch("/api/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "Authorization": `Bearer ${token}` }),
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao excluir conta");
      }

      // Sign out and clear local storage
      await supabase.auth.signOut();
      localStorage.clear();

      toast.success("Conta excluída com sucesso");

      // Redirect to home
      window.location.href = "/";
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Erro ao excluir conta. Tente novamente.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="pb-6">
          <p className="text-xs font-medium text-primary mb-0.5">Configurações</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">
            Gerencie sua conta
          </h1>
        </header>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="flex items-center gap-2 mb-2 overflow-x-auto no-scrollbar">
            {[
              { value: "proposal", label: "Personalizar", icon: FileText },
              { value: "billing", label: "Plano", icon: CreditCard },
              { value: "account", label: "Conta", icon: Settings },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full transition-all whitespace-nowrap flex-shrink-0 touch-feedback btn-press",
                  activeTab === tab.value
                    ? "bg-primary text-white"
                    : "text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200"
                )}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>

        <TabsContent value="proposal">
          <div className={cn(
            "transition-opacity duration-300",
            isRefreshing ? "opacity-0" : "opacity-100"
          )}>
            {/* Seu Perfil */}
            <div className="bg-white rounded-xl border border-neutral-200/80 p-4 sm:p-6 mb-4 animate-card-in card-lift">
              <h2 className="text-base font-semibold text-neutral-900 mb-4">Seu Perfil</h2>
              <div className="flex items-center gap-4">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Foto de perfil"
                    className="w-16 h-16 rounded-full object-cover border-2 border-emerald-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-semibold">
                    {user?.initials || "US"}
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                  />
                  <div className="space-y-2 mb-3">
                    <Label htmlFor="profileName">Seu nome</Label>
                    <Input id="profileName" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Ex: João Silva" />
                  </div>
                  <div className="space-y-2 mb-3">
                    <Label htmlFor="profileEmail">Email da conta</Label>
                    <Input id="profileEmail" value={user?.email || ""} disabled className="bg-neutral-50 text-neutral-500 cursor-not-allowed" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : (
                      <Camera size={14} className="mr-2" />
                    )}
                    {avatarUrl ? "Trocar foto" : "Adicionar foto"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Dados da Empresa */}
            <div className="bg-white rounded-xl border border-neutral-200/80 p-4 sm:p-6 animate-card-in stagger-1 card-lift">
              <h2 className="text-base font-semibold text-neutral-900 mb-4" data-tour="dados-empresa">Sua Empresa</h2>
              <div className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nome da empresa</Label>
                  <Input id="companyName" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Telefone / WhatsApp</Label>
                  <Input id="companyPhone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: formatPhone(e.target.value) })} placeholder="(11) 99999-9999" />
                  <p className="text-xs text-neutral-500">Aparece na proposta para o cliente entrar em contato</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyCnpj">CPF / CNPJ</Label>
                  <Input id="companyCnpj" value={company.cnpj} onChange={(e) => setCompany({ ...company, cnpj: e.target.value })} placeholder="Digite seu CPF ou CNPJ" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Endereço</Label>
                  <Input id="companyAddress" value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} placeholder="Cidade, Estado" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyInstagram">Instagram</Label>
                  <Input id="companyInstagram" value={company.instagram} onChange={(e) => setCompany({ ...company, instagram: e.target.value })} placeholder="@seuinstagram" />
                  <p className="text-xs text-neutral-500">Aparece na proposta para o cliente ver seus trabalhos</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyBio">Apresentação</Label>
                  <textarea
                    id="companyBio"
                    value={company.bio}
                    onChange={(e) => setCompany({ ...company, bio: e.target.value })}
                    placeholder="Ex: Prestador de serviço há 10 anos, especialista em atendimento residencial..."
                    className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
                    maxLength={200}
                  />
                  <p className="text-xs text-neutral-500">{company.bio.length}/200 caracteres • Aparece na proposta</p>
                </div>
                <div className="space-y-2">
                  <Label>Logo da empresa</Label>
                  <div className="flex items-center gap-4">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo da empresa"
                        className="w-20 h-20 rounded-xl object-contain border border-border bg-white"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                        <Palette className="text-neutral-500" size={24} />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        ref={logoInputRef}
                        onChange={handleLogoUpload}
                        accept="image/png,image/jpeg,image/jpg"
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isUploadingLogo}
                      >
                        {isUploadingLogo ? (
                          <Loader2 size={14} className="mr-2 animate-spin" />
                        ) : (
                          <Upload size={14} className="mr-2" />
                        )}
                        {logoUrl ? "Trocar Logo" : "Carregar Logo"}
                      </Button>
                      {logoUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveLogo}
                          disabled={isUploadingLogo}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 size={14} className="mr-2" />
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500">PNG ou JPG, máximo 10MB. O logo aparecerá nas suas propostas.</p>
                </div>
              </div>

              {/* Estilo do Orçamento */}
              <div className="mt-6 pt-6 border-t border-neutral-200">
                <h3 className="text-base font-semibold text-neutral-900 mb-4">Estilo do Orçamento</h3>

              {/* Template de PDF */}
              <div className="mb-5">
                <p className="text-xs text-neutral-500 mb-2">Template do PDF</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "classic", label: "Clássico", desc: "Barra colorida" },
                    { id: "modern", label: "Moderno", desc: "Header gradiente" },
                    { id: "minimal", label: "Minimalista", desc: "Sem cor" },
                  ].map((tpl) => {
                    const active = pdfTemplate === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => {
                          setPdfTemplate(tpl.id as "classic" | "modern" | "minimal");
                          try { localStorage.setItem("fechaqui_pdf_template", tpl.id); } catch { /* ignore */ }
                        }}
                        className={cn(
                          "px-3 py-3 rounded-xl border-2 text-left transition-all",
                          active
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-neutral-200 hover:border-neutral-300"
                        )}
                      >
                        <p className={cn("text-sm font-medium", active ? "text-emerald-900" : "text-neutral-900")}>
                          {tpl.label}
                        </p>
                        <p className={cn("text-[10px] mt-0.5", active ? "text-emerald-700" : "text-neutral-500")}>
                          {tpl.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cor do orçamento */}
              <div className="mb-5" data-tour="estilo-orcamento">
                <p className="text-xs text-neutral-500 mb-2">Cor principal</p>
                <div className="flex items-center gap-2">
                  {[
                    { color: '#059669' },
                    { color: '#0d9488' },
                    { color: '#78716c' },
                  ].map((item) => (
                    <button
                      key={item.color}
                      onClick={() => setProposalSettings({ ...proposalSettings, primaryColor: item.color })}
                      className={`w-10 h-10 rounded-full transition-all ${
                        proposalSettings.primaryColor === item.color
                          ? 'ring-2 ring-offset-2 ring-neutral-900'
                          : 'hover:ring-2 hover:ring-offset-2 hover:ring-neutral-200'
                      }`}
                      style={{ backgroundColor: item.color }}
                    />
                  ))}
                  <label className="relative cursor-pointer">
                    <div
                      className={`w-10 h-10 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center transition-all hover:border-neutral-400 ${
                        !['#059669', '#0d9488', '#78716c'].includes(proposalSettings.primaryColor)
                          ? 'ring-2 ring-offset-2 ring-neutral-900 border-solid'
                          : ''
                      }`}
                      style={!['#059669', '#0d9488', '#78716c'].includes(proposalSettings.primaryColor)
                        ? { backgroundColor: proposalSettings.primaryColor, borderColor: proposalSettings.primaryColor }
                        : {}
                      }
                    >
                      {['#059669', '#0d9488', '#78716c'].includes(proposalSettings.primaryColor) && (
                        <Palette size={16} className="text-neutral-400" />
                      )}
                    </div>
                    <input
                      type="color"
                      value={proposalSettings.primaryColor}
                      onChange={(e) => setProposalSettings({ ...proposalSettings, primaryColor: e.target.value })}
                      className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </div>

              {/* O que mostrar */}
              <div className="mb-5">
                <p className="text-xs text-neutral-500 mb-2">Mostrar na proposta</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setProposalSettings({ ...proposalSettings, showLogo: !proposalSettings.showLogo })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      proposalSettings.showLogo
                        ? 'bg-primary text-white'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    <Image size={14} />
                    Logo
                  </button>
                  <button
                    onClick={() => setProposalSettings({ ...proposalSettings, showCnpj: !proposalSettings.showCnpj })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      proposalSettings.showCnpj
                        ? 'bg-primary text-white'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    <FileText size={14} />
                    CPF/CNPJ
                  </button>
                  <button
                    onClick={() => setProposalSettings({ ...proposalSettings, showAddress: !proposalSettings.showAddress })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      proposalSettings.showAddress
                        ? 'bg-primary text-white'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    <MapPin size={14} />
                    Endereço
                  </button>
                  <button
                    onClick={() => setProposalSettings({ ...proposalSettings, showInstagram: !proposalSettings.showInstagram })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      proposalSettings.showInstagram
                        ? 'bg-primary text-white'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    <Instagram size={14} />
                    Instagram
                  </button>
                  <button
                    onClick={() => setProposalSettings({ ...proposalSettings, showBio: !proposalSettings.showBio })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      proposalSettings.showBio
                        ? 'bg-primary text-white'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    }`}
                  >
                    <AlignLeft size={14} />
                    Bio
                  </button>
                </div>
              </div>

              {/* Mensagem rodapé */}
              <div className="mb-6">
                <p className="text-sm font-medium mb-2">Mensagem no rodapé (opcional)</p>
                <Input
                  value={proposalSettings.footerText}
                  onChange={(e) => setProposalSettings({ ...proposalSettings, footerText: e.target.value })}
                  placeholder="Ex: Obrigado pela preferência!"
                  maxLength={100}
                />
              </div>

              {/* Condições de Pagamento */}
              <div className="mb-6">
                <p className="text-sm font-medium mb-2">Condições de Pagamento</p>
                <textarea
                  value={proposalSettings.paymentTerms}
                  onChange={(e) => setProposalSettings({ ...proposalSettings, paymentTerms: e.target.value })}
                  placeholder="• 50% no fechamento do contrato&#10;• 50% na conclusão do serviço"
                  className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-neutral-500 mt-1">Use "•" no início de cada linha para criar uma lista</p>
              </div>

              {/* Termos */}
              <div className="mb-6">
                <p className="text-sm font-medium mb-2">Termos e Garantias</p>
                <textarea
                  value={proposalSettings.generalTerms}
                  onChange={(e) => setProposalSettings({ ...proposalSettings, generalTerms: e.target.value })}
                  placeholder="• Garantia de 30 dias após a conclusão&#10;• Materiais inclusos conforme especificado"
                  className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-neutral-500 mt-1">A validade da proposta é adicionada automaticamente</p>
              </div>

              {/* Preview REAL do Orçamento */}
              <div className="mb-6" data-tour="previa-orcamento">
                <p className="text-sm font-medium mb-3">Prévia do Orçamento (como o cliente verá)</p>
                <div className="bg-slate-100 p-3 rounded-xl">
                  <div className="bg-white shadow-lg rounded-sm border border-slate-200 overflow-hidden transform scale-[0.85] origin-top">

                    {/* Barra colorida */}
                    <div className="h-1" style={{ backgroundColor: proposalSettings.primaryColor }} />

                    {/* Cabeçalho */}
                    <div className="border-b border-slate-200 p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                          {proposalSettings.showLogo && (
                            logoUrl ? (
                              <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${proposalSettings.primaryColor}15` }}>
                                <Leaf className="w-6 h-6" style={{ color: proposalSettings.primaryColor }} />
                              </div>
                            )
                          )}
                          <div>
                            <h1 className="text-sm font-bold text-stone-900 uppercase tracking-wide">
                              {company.name || "Sua Empresa"}
                            </h1>
                            {proposalSettings.showCnpj && (
                              <p className="text-stone-500 text-xs mt-0.5">{company.cnpj || "00.000.000/0001-00"}</p>
                            )}
                            {proposalSettings.showAddress && (
                              <p className="text-stone-500 text-xs">{company.address || "Cidade, Estado"}</p>
                            )}
                            {proposalSettings.showInstagram && (
                              <p className="text-xs mt-0.5" style={{ color: proposalSettings.primaryColor }}>{company.instagram || "@instagram"}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-stone-900">ORÇAMENTO</p>
                          <p className="text-stone-500 text-xs">Nº ABC123</p>
                        </div>
                      </div>
                      {proposalSettings.showBio && (
                        <p className="text-xs text-stone-500 italic mt-3 pt-3 border-t border-dashed">
                          "{company.bio || "Prestador de servico profissional ha mais de 10 anos. Especialista em atendimento residencial e comercial com qualidade e pontualidade."}"
                        </p>
                      )}
                    </div>

                    {/* Info Cliente */}
                    <div className="grid grid-cols-2 border-b border-stone-200 text-xs">
                      <div className="p-3 border-r border-stone-200">
                        <p className="text-[10px] text-stone-400 uppercase mb-1">Cliente</p>
                        <p className="font-semibold text-stone-900">João da Silva</p>
                        <p className="text-stone-500">(11) 99999-9999</p>
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-stone-400 uppercase mb-1">Data</p>
                          <p className="text-stone-900">20/01/2026</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 uppercase mb-1">Validade</p>
                          <p className="text-stone-900">27/01/2026</p>
                        </div>
                      </div>
                    </div>

                    {/* Título */}
                    <div className="px-3 py-2 border-b border-stone-200" style={{ backgroundColor: `${proposalSettings.primaryColor}08` }}>
                      <p className="text-[10px] text-stone-400 uppercase">Referente a</p>
                      <p className="font-semibold text-stone-900 text-xs">Serviço Prestado</p>
                    </div>

                    {/* Tabela */}
                    <div className="p-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b-2 border-stone-300">
                            <th className="text-left py-1.5 text-[10px] text-stone-500 uppercase font-medium">Item</th>
                            <th className="text-center py-1.5 text-[10px] text-stone-500 uppercase font-medium w-8">Qtd</th>
                            <th className="text-right py-1.5 text-[10px] text-stone-500 uppercase font-medium w-14">Unit.</th>
                            <th className="text-right py-1.5 text-[10px] text-stone-500 uppercase font-medium w-14">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-stone-100">
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${proposalSettings.primaryColor}15` }}>
                                  <Leaf className="w-3 h-3" style={{ color: proposalSettings.primaryColor }} />
                                </div>
                                <span className="font-medium text-stone-900">Poda de árvores</span>
                              </div>
                            </td>
                            <td className="py-2 text-center text-stone-600">2</td>
                            <td className="py-2 text-right text-stone-600">R$ 150</td>
                            <td className="py-2 text-right font-medium text-stone-900">R$ 300</td>
                          </tr>
                          <tr className="border-b border-stone-100">
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${proposalSettings.primaryColor}15` }}>
                                  <Leaf className="w-3 h-3" style={{ color: proposalSettings.primaryColor }} />
                                </div>
                                <span className="font-medium text-stone-900">Limpeza geral</span>
                              </div>
                            </td>
                            <td className="py-2 text-center text-stone-600">1</td>
                            <td className="py-2 text-right text-stone-600">R$ 200</td>
                            <td className="py-2 text-right font-medium text-stone-900">R$ 200</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Total */}
                      <div className="mt-3 flex justify-end">
                        <div className="w-32">
                          <div className="flex justify-between py-1.5 border-b-2 border-stone-800">
                            <span className="font-bold text-stone-900 text-sm">TOTAL</span>
                            <span className="font-bold text-sm" style={{ color: proposalSettings.primaryColor }}>R$ 500</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Botão Aprovar */}
                    <div className="px-3 py-3 border-t border-slate-200 text-center">
                      <button
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-white text-xs font-medium rounded"
                        style={{ backgroundColor: proposalSettings.primaryColor }}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Aprovar Orçamento
                      </button>
                    </div>

                    {/* Rodapé personalizado */}
                    {proposalSettings.footerText && (
                      <div className="px-3 py-2 border-t text-center text-xs" style={{ color: proposalSettings.primaryColor, backgroundColor: `${proposalSettings.primaryColor}05` }}>
                        {proposalSettings.footerText}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleSaveProposalSettings}
                className={cn(
                  "w-full mt-6 transition-all touch-manipulation",
                  showSaveSuccess && "bg-emerald-500 hover:bg-emerald-500"
                )}
                disabled={isSavingStyle}
              >
                {isSavingStyle ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : showSaveSuccess ? (
                  <>
                    <CheckCircle size={16} className="mr-2" />
                    Salvo!
                  </>
                ) : (
                  "Salvar Configurações"
                )}
              </Button>
            </div>
          </div>
          </div>
        </TabsContent>

        <TabsContent value="account">
          <div className="space-y-6">
            {/* Notificações */}
            <div className="bg-white rounded-xl border border-neutral-200/80 p-4 sm:p-6">
              <h2 className="text-base font-semibold text-neutral-900 mb-4">Notificações</h2>
              <div className="space-y-4 max-w-xl">
                <div className="flex items-center justify-between">
                  <div><p className="font-medium text-sm">Proposta visualizada</p><p className="text-xs text-neutral-500">Quando um cliente visualizar sua proposta</p></div>
                  <Switch checked={notifications.proposalViewed} onCheckedChange={(checked) => setNotifications({ ...notifications, proposalViewed: checked })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="font-medium text-sm">Proposta aprovada</p><p className="text-xs text-neutral-500">Quando um cliente aprovar sua proposta</p></div>
                  <Switch checked={notifications.proposalApproved} onCheckedChange={(checked) => setNotifications({ ...notifications, proposalApproved: checked })} />
                </div>
              </div>
              <Button onClick={handleSaveNotifications} className="mt-4" size="sm">Salvar</Button>
            </div>

            {/* Alterar Senha */}
            <div className="bg-white rounded-xl border border-neutral-200/80 p-4 sm:p-6">
              <h2 className="text-base font-semibold text-neutral-900 mb-4">Alterar Senha</h2>
              <div className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Senha atual</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPasswords ? "text" : "password"}
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPasswords ? "text" : "password"}
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">Confirmar nova senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmNewPassword"
                      type={showPasswords ? "text" : "password"}
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button onClick={handleChangePassword} disabled={isSaving} size="sm">
                  {isSaving ? "Alterando..." : "Alterar Senha"}
                </Button>
              </div>
            </div>

            {/* Excluir Conta */}
            <div className="bg-white rounded-xl border border-red-200 p-4 sm:p-6">
              <h2 className="text-base font-semibold text-red-600 mb-2">Excluir Conta</h2>
              <p className="text-sm text-neutral-500 mb-4">Ao excluir sua conta, todos os seus dados serão permanentemente removidos.</p>
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteModal(true)}>Excluir Conta</Button>
            </div>

            {/* Modal de Confirmação de Exclusão */}
            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-red-600">Excluir Conta</DialogTitle>
                  <DialogDescription>
                    Esta ação é irreversível. Todos os seus dados serão permanentemente excluídos, incluindo:
                  </DialogDescription>
                </DialogHeader>
                <ul className="text-sm text-neutral-600 list-disc list-inside space-y-1 my-4">
                  <li>Todas as propostas e orçamentos</li>
                  <li>Dados do perfil e empresa</li>
                  <li>Imagens e logos</li>
                  <li>Histórico de notificações</li>
                </ul>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="deleteConfirm" className="text-sm">
                      Digite <strong>EXCLUIR</strong> para confirmar:
                    </Label>
                    <Input
                      id="deleteConfirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                      placeholder="EXCLUIR"
                      className="mt-2"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowDeleteModal(false);
                        setDeleteConfirmText("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== "EXCLUIR" || isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Excluindo...
                        </>
                      ) : (
                        "Excluir Conta"
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Modal de Crop do Logo */}
            <Dialog open={showCropModal} onOpenChange={(open) => {
              if (!open) {
                setShowCropModal(false);
                setImageToCrop(null);
              }
            }}>
              <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 overflow-hidden max-h-[90vh]">
                <DialogHeader className="p-4 pb-2">
                  <DialogTitle>Ajustar Logo</DialogTitle>
                  <DialogDescription>
                    Arraste e use o zoom para enquadrar
                  </DialogDescription>
                </DialogHeader>
                <div className="relative w-full h-[250px] sm:h-[300px] bg-neutral-900 touch-none">
                  {imageToCrop && (
                    <Cropper
                      image={imageToCrop}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onCropComplete={onCropComplete}
                      onZoomChange={setZoom}
                      cropShape="rect"
                      showGrid={false}
                      objectFit="contain"
                    />
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <ZoomOut size={20} className="text-neutral-500 flex-shrink-0" />
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.05}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="flex-1 h-3 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <ZoomIn size={20} className="text-neutral-500 flex-shrink-0" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowCropModal(false);
                        setImageToCrop(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleCropAndUpload}
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar Logo"
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        <TabsContent value="billing">
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="bg-white rounded-xl border border-neutral-200/80 p-4 sm:p-6">
              <h2 className="text-base font-semibold text-neutral-900 mb-4">Sua Assinatura</h2>
              <div className="bg-verde-50 border border-verde-200 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-sm text-neutral-500">Plano atual</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-primary capitalize">
                        {userPlan === "admin" ? "Admin" : userPlan === "free" ? "Grátis" : userPlan === "essential" ? "Mensal" : "Anual"}
                      </p>
                      {planStatus === "overdue" && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                          Vencido
                        </span>
                      )}
                      {planStatus === "cancelled" && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full">
                          Cancelado
                        </span>
                      )}
                      {userPlan === "free" && user?.isInTrial && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-600 rounded-full">
                          <Clock size={12} />
                          Trial
                        </span>
                      )}
                      {userPlan === "free" && !user?.isInTrial && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded-full">
                          Trial Expirado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-500">
                      {userPlan === "admin" ? "Tudo liberado" : userPlan === "free" ? "R$ 0/mês" : userPlan === "essential" ? "R$ 97/mês" : "R$ 804/ano (R$ 67/mês)"}
                    </p>
                  </div>
                  {userPlan !== "pro" && userPlan !== "admin" && (
                    <Button asChild><Link to="/upgrade">Fazer Upgrade</Link></Button>
                  )}
                </div>

                {/* Info do trial para plano Grátis */}
                {userPlan === "free" && user?.isInTrial && (
                  <div className="mt-4 pt-4 border-t border-verde-200">
                    <p className="text-xs text-neutral-500">
                      Trial: <span className="font-medium text-neutral-700">
                        {user?.trialEndsAt ? (
                          `${Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} dias restantes`
                        ) : "3 dias"}
                      </span>
                    </p>
                  </div>
                )}

                {/* Info adicional do plano pago */}
                {userPlan !== "free" && daysRemaining !== null && (
                  <div className="mt-4 pt-4 border-t border-verde-200 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-neutral-500">Status</p>
                      <p className="font-medium text-neutral-900">
                        {planStatus === "active" ? "Ativo" : planStatus === "overdue" ? "Pagamento pendente" : planStatus === "cancelled" ? "Cancelado" : "Ativo"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">
                        {planStatus === "cancelled" ? "Acesso até" : "Próxima cobrança"}
                      </p>
                      <p className="font-medium text-neutral-900">
                        {nextBillingDate ? new Date(nextBillingDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Dias restantes</p>
                      <p className={cn(
                        "font-medium",
                        daysRemaining <= 3 ? "text-red-600" : daysRemaining <= 7 ? "text-amber-600" : "text-neutral-900"
                      )}>
                        {daysRemaining} {daysRemaining === 1 ? "dia" : "dias"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <h3 className="font-medium mb-3">Uso do plano</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm py-2 border-b border-neutral-100">
                    <span className="text-neutral-600">Propostas este mês</span>
                    <span className="font-medium">{monthlyProposalsCount} / {monthlyLimit === Infinity ? "∞" : monthlyLimit}</span>
                  </div>
                  <div className="flex justify-between text-sm py-2 border-b border-neutral-100">
                    <span className="text-neutral-600">Clientes cadastrados</span>
                    <span className="font-medium">{clientsCount} / {user?.isAdmin || user?.isInTrial ? "∞" : userPlan === "free" ? 5 : "∞"}</span>
                  </div>
                  <div className="flex justify-between text-sm py-2">
                    <span className="text-neutral-600">Itens personalizados</span>
                    <span className="font-medium">{user?.isAdmin || user?.isInTrial ? "∞" : userPlan === "free" ? 0 : userPlan === "essential" ? 20 : "∞"}</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Payment History */}
            <div className="bg-white rounded-xl border border-neutral-200/80 p-4 sm:p-6">
              <h2 className="text-base font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Receipt size={20} />
                Histórico de Pagamentos
              </h2>
              {payments.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <CreditCard className="mx-auto mb-3 opacity-50" size={40} />
                  <p>Nenhum pagamento ainda</p>
                  <p className="text-sm mt-1">Seus pagamentos aparecerão aqui quando você assinar um plano.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          payment.status === "paid" ? "bg-green-100" :
                          payment.status === "pending" ? "bg-amber-100" : "bg-red-100"
                        }`}>
                          {payment.status === "paid" ? (
                            <CheckCircle className="text-green-600" size={20} />
                          ) : payment.status === "pending" ? (
                            <Clock className="text-amber-600" size={20} />
                          ) : (
                            <AlertCircle className="text-red-600" size={20} />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">Plano {payment.plan}</p>
                          <p className="text-sm text-neutral-500">
                            {new Date(payment.date).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(payment.amount)}
                          </p>
                          <p className={`text-xs ${
                            payment.status === "paid" ? "text-green-600" :
                            payment.status === "pending" ? "text-amber-600" : "text-red-600"
                          }`}>
                            {payment.status === "paid" ? "Pago" :
                             payment.status === "pending" ? "Pendente" : "Falhou"}
                          </p>
                        </div>
                        {payment.invoiceUrl && (
                          <a
                            href={payment.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neutral-500 hover:text-foreground"
                          >
                            <ExternalLink size={18} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subscription Management */}
            {userPlan !== "free" && (
              <div className="bg-white rounded-xl border border-neutral-200/80 p-4 sm:p-6">
                <h2 className="text-base font-semibold text-neutral-900 mb-4">Gerenciar Assinatura</h2>

                {/* Cancelled subscription notice */}
                {planStatus === "cancelled" && planExpiresAt && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="text-amber-600 mt-0.5" size={20} />
                      <div>
                        <p className="font-medium text-amber-800">Assinatura cancelada</p>
                        <p className="text-sm text-amber-700 mt-1">
                          Você ainda tem acesso ao plano {userPlan === "essential" ? "Mensal" : "Anual"} até{" "}
                          <strong>
                            {new Date(planExpiresAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </strong>
                          . Após essa data, você voltará para o plano gratuito.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    {planStatus === "cancelled" ? (
                      <Button
                        disabled={isReactivating}
                        onClick={async () => {
                          setIsReactivating(true);
                          try {
                            const response = await fetch("/api/subscription?action=reactivate", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                userId: user?.id,
                                plan: userPlan,
                                period: "monthly",
                                customerEmail: user?.email,
                              }),
                            });
                            const data = await response.json();
                            if (response.ok) {
                              if (data.reactivated) {
                                // Ainda dentro do período pago - só reativou sem cobrar
                                toast.success("Assinatura reativada com sucesso!");
                                setPlanStatus("active");
                              } else if (data.paymentUrl) {
                                // Período expirou - precisa pagar
                                window.location.href = data.paymentUrl;
                              }
                            } else {
                              toast.error(data.error || "Erro ao reativar assinatura");
                            }
                          } catch (error) {
                            toast.error("Erro ao reativar assinatura");
                          } finally {
                            setIsReactivating(false);
                          }
                        }}
                      >
                        {isReactivating ? (
                          <>
                            <Loader2 size={16} className="animate-spin mr-2" />
                            Reativando...
                          </>
                        ) : (
                          "Reativar Assinatura"
                        )}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/5"
                          onClick={async () => {
                            if (!confirm("Tem certeza que deseja cancelar sua assinatura? Você continuará com acesso até o final do período pago.")) {
                              return;
                            }
                            try {
                              const response = await fetch("/api/subscription?action=cancel", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ userId: user?.id, userEmail: user?.email }),
                              });
                              const data = await response.json();
                              if (response.ok) {
                                toast.success("Assinatura cancelada. Você ainda tem acesso até o final do período pago.");
                                // Update local state instead of reloading
                                setPlanStatus("cancelled");
                                if (data.planExpiresAt) {
                                  setPlanExpiresAt(data.planExpiresAt);
                                }
                              } else {
                                toast.error(data.error || "Erro ao cancelar assinatura");
                              }
                            } catch (error) {
                              toast.error("Erro ao cancelar assinatura");
                            }
                          }}
                        >
                          Cancelar assinatura
                        </Button>
                      </>
                    )}
                  </div>
                  {planStatus !== "cancelled" && (
                    <p className="text-sm text-neutral-500">
                      Ao cancelar, você continuará com acesso até o final do período pago.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

        <div className="h-6" />
      </div>
    </DashboardLayout>
  );
}
