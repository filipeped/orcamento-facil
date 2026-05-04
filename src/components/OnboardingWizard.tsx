import { useState, useRef } from "react";
import {
  Leaf,
  Building2,
  ChevronRight,
  Loader2,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getSupabase, getStoredSession, isTokenExpired, refreshSession } from "@/lib/supabase";
import { toast } from "sonner";

// Helper to ensure valid token before API calls
async function ensureValidToken(): Promise<boolean> {
  const session = getStoredSession();
  if (!session) return false;

  if (isTokenExpired(session)) {
    const refreshed = await refreshSession();
    return !!refreshed;
  }
  return true;
}

interface OnboardingWizardProps {
  userId: string;
  userName?: string;
  onComplete: () => void;
}

export function OnboardingWizard({ userId, userName, onComplete }: OnboardingWizardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }

    setIsUploading(true);
    try {
      // Ensure token is valid before upload
      const hasValidToken = await ensureValidToken();
      if (!hasValidToken) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/logo.${fileExt}`;

      const { error: uploadError } = await getSupabase().storage
        .from("logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      const { data: urlData } = getSupabase().storage
        .from("logos")
        .getPublicUrl(fileName);

      setLogoUrl(urlData.publicUrl + "?t=" + Date.now());
      toast.success("Logo carregado!");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Erro ao carregar logo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Ensure token is valid before saving
      const hasValidToken = await ensureValidToken();
      if (!hasValidToken) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const { error } = await getSupabase()
        .from("profiles")
        .upsert({
          user_id: userId,
          company_name: companyName || null,
          logo_url: logoUrl,
          onboarding_completed: true,
          show_tour: true,
        }, { onConflict: "user_id" });

      if (error) throw error;

      onComplete();
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      // Ensure token is valid before saving
      const hasValidToken = await ensureValidToken();
      if (!hasValidToken) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      await getSupabase()
        .from("profiles")
        .upsert({
          user_id: userId,
          onboarding_completed: true,
          show_tour: true,
        }, { onConflict: "user_id" });
      onComplete();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const firstName = userName?.split(" ")[0] || "";

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
          {/* Header verde estilo Faturamento */}
          <div className="relative overflow-hidden bg-primary p-5 text-white">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Leaf className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium text-white/80">Bem-vindo ao OrçaFácil</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {firstName ? `Olá, ${firstName}!` : "Bem-vindo!"}
              </h1>
              <p className="text-sm text-white/70 mt-1">
                Vamos configurar sua empresa
              </p>
            </div>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
            <div className="absolute -right-4 -bottom-12 w-28 h-28 rounded-full bg-white/5" />
          </div>

          {/* Form */}
          <div className="p-6 space-y-5">
            {/* Logo Upload */}
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
              <label className="text-sm font-medium text-neutral-700 mb-3 block">
                Logo da empresa
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoUpload}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploading}
                  className={cn(
                    "w-16 h-16 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all flex-shrink-0 bg-white",
                    logoUrl
                      ? "border-emerald-300 p-1"
                      : "border-neutral-300 hover:border-emerald-400 hover:bg-emerald-50"
                  )}
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                  ) : logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain rounded-lg" />
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-neutral-400" />
                      <span className="text-[9px] text-neutral-500">Adicionar</span>
                    </>
                  )}
                </button>
                <p className="text-xs text-neutral-500">Opcional - aparece nos seus orçamentos</p>
              </div>
            </div>

            {/* Company Name */}
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-2 block">
                Nome da empresa
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: João Serviços"
                  className="pl-10 h-12 rounded-xl"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <Button
                onClick={handleComplete}
                disabled={isLoading}
                className="w-full h-12 rounded-xl"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continuar
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </>
                )}
              </Button>

              <button
                onClick={handleSkip}
                disabled={isLoading}
                className="w-full py-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                Configurar depois
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
