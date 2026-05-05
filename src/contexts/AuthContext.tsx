import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase, getSupabase, getStoredSession, clearStoredSession, SESSION_STORAGE_KEY, isTokenExpired, refreshSession } from "@/lib/supabase";
import { DeduplicationEngine } from "@/tracking/core/DeduplicationEngine";
import { BrowserPixelProvider } from "@/tracking/providers/BrowserPixelProvider";
import { RealCAPIProvider } from "@/tracking/providers/RealCAPIProvider";
import { CookieManager } from "@/tracking/utils/CookieManager";
import { IPDetector } from "@/tracking/utils/IPDetector";
import { GeoEnrichment } from "@/tracking/utils/GeoEnrichment";


// Funcao para hash SHA256
async function hashSHA256(value: string): Promise<string> {
  if (!value || typeof value !== "string") return "";
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(value.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

// Tracking de Lead no cadastro (usando email em vez de telefone)
async function trackUserRegistered(userData: { email: string; name?: string; userId: string }) {
  try {
    console.log("REGISTRO: Iniciando tracking com email...");
    
    const trackKey = `user_registered_tracked_${userData.userId}`;
    if (sessionStorage.getItem(trackKey)) {
      console.log("Registro tracking: Ja disparado nesta sessao");
      return false;
    }

    const eventId = await DeduplicationEngine.generateEventId("user_registered");
    const externalId = await DeduplicationEngine.getValidExternalId();
    const fbp = await CookieManager.getFbpWithPixelWait();
    const fbc = CookieManager.getFbcWithFallback();
    const clientIP = await IPDetector.getClientIPForCAPI();
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);

    const hashedEmail = await hashSHA256(userData.email);

    let hashedFirstName = "";
    let hashedLastName = "";
    if (userData.name) {
      const nameParts = userData.name.trim().split(" ");
      hashedFirstName = await hashSHA256((nameParts[0] || "").toLowerCase().trim());
      hashedLastName = await hashSHA256((nameParts.length > 1 ? nameParts[nameParts.length - 1] : "").toLowerCase().trim());
    }

    const formattedIP = clientIP ? IPDetector.formatIPForMeta(clientIP) : null;
    const capiUserData: Record<string, any> = {
      external_id: externalId,
      client_user_agent: navigator.userAgent,
      ...(fbp && { fbp }),
      ...(fbc && { fbc }),
      ...(formattedIP && { client_ip_address: formattedIP }),
      ...(hashedEmail && { em: hashedEmail }),
      ...(hashedFirstName && { fn: hashedFirstName }),
      ...(hashedLastName && { ln: hashedLastName }),
      ...(geoData?.ct && { ct: geoData.ct }),
      ...(geoData?.st && { st: geoData.st }),
      ...(geoData?.zp && { zp: geoData.zp }),
      ...(geoData?.country && { country: geoData.country }),
    };

    // ✅ PADRONIZADO: Mesmos valores que Cadastro.tsx e metaPixel.ts para evitar duplicação
    const customData = {
      content_name: "lead_jardinei",
      content_category: "jardinei_lead",
      source: "form_submit",
      value: 50, // Valor fixo intermediário para registro via AuthContext
      currency: "BRL"
    };

    const pixelUserData: Record<string, string> = {};
    if (hashedEmail) pixelUserData.em = hashedEmail;
    if (hashedFirstName) pixelUserData.fn = hashedFirstName;
    if (hashedLastName) pixelUserData.ln = hashedLastName;

    let pixelSuccess = false;
    try {
      pixelSuccess = BrowserPixelProvider.trackEvent("Lead", customData, { eventID: eventId }, pixelUserData);
    } catch (err) {
      console.error("Erro Pixel Registration:", err);
    }

    let capiSuccess = false;
    try {
      const capiPayload = RealCAPIProvider.prepareCAPIPayload("Lead", eventId, capiUserData, customData);
      capiSuccess = await RealCAPIProvider.sendEvent(capiPayload);
    } catch (err) {
      console.error("Erro CAPI Registration:", err);
    }

    sessionStorage.setItem(trackKey, "true");
    
    console.log("REGISTRO: Resultado tracking:", { pixelSuccess, capiSuccess });
    return pixelSuccess || capiSuccess;
  } catch (error) {
    console.error("REGISTRO: Erro critico tracking:", error);
    return false;
  }
}

interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  plan: string;
  planStatus: string;
  company: string;
  isAdmin: boolean;
  isInTrial: boolean; // true se esta nos primeiros 3 dias (trial)
  trialEndsAt: string | null; // data que o trial acaba
  phoneVerified: boolean;
}

// DuraÃ§Ã£o do trial em dias
const TRIAL_DAYS = 3;

// Verifica se está no período de trial (3 dias após plan_started_at ou created_at)
function checkIsInTrial(planStartedAt: string | null, createdAt: string | null, plan: string): { isInTrial: boolean; trialEndsAt: string | null } {
  // SÃ³ aplica trial para plano free (Grátis)
  if (plan !== 'free') {
    return { isInTrial: false, trialEndsAt: null };
  }

  // Usar plan_started_at ou created_at como fallback
  const startDateStr = planStartedAt || createdAt;
  if (!startDateStr) {
    return { isInTrial: true, trialEndsAt: null }; // Sem data, assume novo usuÃ¡rio
  }

  const startDate = new Date(startDateStr);
  const trialEndDate = new Date(startDate);
  trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);

  const now = new Date();
  const isInTrial = now < trialEndDate;

  return {
    isInTrial,
    trialEndsAt: trialEndDate.toISOString()
  };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; isAdmin?: boolean }>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<{ success: boolean; error?: string; needsConfirmation?: boolean }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session user from localStorage
interface SessionUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
}

// Convert session user to our User type
async function getUserData(sessionUser: SessionUser): Promise<User> {
  let profile = null;

  try {
    // Try to get profile from database (user_id is the foreign key to auth.users)
    const { data, error } = await getSupabase()
      .from("profiles")
      .select("*")
      .eq("user_id", sessionUser.id)
      .single();

    if (!error) {
      profile = data;
    } else {
      console.log("Profile fetch error (normal for new users):", error.message);
    }
  } catch (err) {
    console.log("Profile fetch exception:", err);
  }

  // Get name from profile, user metadata (Google), or email
  const name = profile?.full_name ||
               sessionUser.user_metadata?.full_name ||
               sessionUser.user_metadata?.name ||
               sessionUser.email?.split("@")[0] ||
               "Usuario";

  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  // Mapear plano para nome amigÃ¡vel
  const planNames: Record<string, string> = {
    free: "Grátis",
    essential: "Mensal",
    pro: "Anual",
    admin: "Admin",
  };

  const userPlan = profile?.is_admin ? "admin" : (profile?.plan || "free");
  const trialStatus = profile?.is_admin ? { isInTrial: false, trialEndsAt: null } : checkIsInTrial(profile?.plan_started_at, profile?.created_at, userPlan);

  // Cache dados do profile para tracking (Meta CAPI) - ponte entre React context e metaPixel.ts
  try {
    const trackingData: Record<string, string> = {};
    if (sessionUser.email) trackingData.email = sessionUser.email;
    if (profile?.phone) trackingData.phone = profile.phone;
    if (profile?.full_name) trackingData.full_name = profile.full_name;
    else if (name && name !== "Usuario") trackingData.full_name = name;
    localStorage.setItem('jardinei_profile_tracking', JSON.stringify(trackingData));
  } catch { /* ignore */ }

  return {
    id: sessionUser.id,
    name,
    email: sessionUser.email || "",
    initials,
    plan: planNames[userPlan] || "Grátis",
    planStatus: profile?.plan_status || "active",
    company: profile?.company_name || "",
    isAdmin: profile?.is_admin || false,
    isInTrial: trialStatus.isInTrial,
    trialEndsAt: trialStatus.trialEndsAt,
    phoneVerified: profile?.phone_verified || false,
  };
}

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";

const FAKE_USER: User = {
  id: "demo-user-id",
  name: "Usuário Demo",
  email: "demo@orcafacil.local",
  initials: "UD",
  plan: "Anual",
  planStatus: "active",
  company: "Minha Empresa Demo",
  isAdmin: true,
  isInTrial: false,
  trialEndsAt: null,
  phoneVerified: true,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(BYPASS_AUTH ? FAKE_USER : null);
  const [isLoading, setIsLoading] = useState(BYPASS_AUTH ? false : true);

  useEffect(() => {
    if (BYPASS_AUTH) {
      console.log("AuthContext: BYPASS mode active - using fake demo user");
      return;
    }

    // Check session from localStorage (manual approach - bypasses broken Supabase APIs)
    const checkSession = async () => {
      // Skip check if on auth callback page (it will handle auth)
      if (window.location.pathname === "/auth/callback") {
        console.log("AuthContext: On callback page, skipping check");
        setIsLoading(false);
        return;
      }

      console.log("AuthContext: Checking localStorage session...");
      let session = getStoredSession();

      // Check if token is expired and try to refresh
      if (session && isTokenExpired(session)) {
        console.log("AuthContext: Token expired, attempting refresh...");
        const refreshedSession = await refreshSession();
        if (refreshedSession) {
          session = refreshedSession;
          console.log("AuthContext: Token refreshed successfully");
        } else {
          console.log("AuthContext: Token refresh failed, user needs to re-login");
          setIsLoading(false);
          return;
        }
      }

      if (session?.user) {
        console.log("AuthContext: Found session for:", session.user.email);
        try {
          // Ensure profile exists and get data in single upsert query
          const fullName = session.user.user_metadata?.full_name ||
                          session.user.user_metadata?.name ||
                          session.user.email?.split("@")[0] || "Usuario";

          // Pegar telefone do metadata (salvo durante o cadastro)
          const phoneFromMetadata = session.user.user_metadata?.phone || null;
          console.log("ðŸ“± CHECK SESSION - Phone do metadata:", phoneFromMetadata);

          // Check if profile exists first
          let { data: profile } = await getSupabase()
            .from("profiles")
            .select("*")
            .eq("user_id", session.user.id)
            .single();

          // Only create if doesn't exist (preserves is_admin)
          if (!profile) {
            console.log("ðŸ“± CHECK SESSION - Perfil NÃƒO existe, criando com phone:", phoneFromMetadata);
            const { data: newProfile } = await getSupabase()
              .from("profiles")
              .insert({
                user_id: session.user.id,
                full_name: fullName,
                phone: phoneFromMetadata,
              })
              .select("*")
              .single();
            profile = newProfile;
          } else if (!profile.phone && phoneFromMetadata) {
            // Se perfil existe mas nÃ£o tem telefone, atualizar
            console.log("ðŸ“± CHECK SESSION - Perfil existe SEM phone, atualizando com:", phoneFromMetadata);
            await getSupabase()
              .from("profiles")
              .update({ phone: phoneFromMetadata })
              .eq("user_id", session.user.id);
            profile.phone = phoneFromMetadata;
          } else {
            console.log("ðŸ“± CHECK SESSION - Perfil jÃ¡ tem phone:", profile.phone);
          }


          // Novos usuários: 3 dias trial (tudo liberado), depois Grátis (0 propostas/mês)
          // Se quiser mais, paga Mensal ou Anual
          if (profile && profile.plan === 'free' && !profile.plan_started_at) {
            const { error: setupError } = await getSupabase()
              .from("profiles")
              .update({
                plan: 'free', // Grátis
                plan_status: 'active',
                plan_started_at: new Date().toISOString(),
                show_tour: true,
              })
              .eq("user_id", session.user.id);

            if (!setupError) {
              profile.plan = 'free';
              profile.plan_status = 'active';
              console.log("Plano Grátis ativado para:", session.user.email);
            }
          }

          // Build user data from profile (avoiding extra query)
          const name = profile?.full_name || fullName;
          const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
          const planNames: Record<string, string> = { free: "Grátis", essential: "Mensal", pro: "Anual", admin: "Admin" };
          const userPlan = profile?.is_admin ? "admin" : (profile?.plan || "free");
          const trialStatus = profile?.is_admin ? { isInTrial: false, trialEndsAt: null } : checkIsInTrial(profile?.plan_started_at, profile?.created_at, userPlan);

          setUser({
            id: session.user.id,
            name,
            email: session.user.email || "",
            initials,
            plan: planNames[userPlan] || "Grátis",
            planStatus: profile?.plan_status || "active",
            company: profile?.company_name || "",
            isAdmin: profile?.is_admin || false,
            isInTrial: trialStatus.isInTrial,
            trialEndsAt: trialStatus.trialEndsAt,
            phoneVerified: profile?.phone_verified || false,
          });
          console.log("AuthContext: User loaded:", session.user.email, "| Trial:", trialStatus.isInTrial);
        } catch (err) {
          console.error("AuthContext: getUserData error:", err);
          // Still set basic user (assume in trial for new users)
          setUser({
            id: session.user.id,
            name: session.user.email?.split("@")[0] || "Usuario",
            email: session.user.email || "",
            initials: (session.user.email?.substring(0, 2) || "US").toUpperCase(),
            plan: "Grátis",
            planStatus: "active",
            company: "",
            isAdmin: false,
            isInTrial: true,
            trialEndsAt: null,
            phoneVerified: false,
          });
        }
      } else {
        console.log("AuthContext: No session found");
      }

      setIsLoading(false);
    };

    checkSession();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; isAdmin?: boolean }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Translate common errors to Portuguese
        let errorMessage = error.message;
        if (error.message.includes("Invalid login credentials")) {
          errorMessage = "Email ou senha incorretos";
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage = "Confirme seu email antes de fazer login. Verifique sua caixa de entrada e spam.";
        } else if (error.message.includes("Too many requests")) {
          errorMessage = "Muitas tentativas. Aguarde alguns minutos.";
        } else if (error.message.includes("User not found")) {
          errorMessage = "Usuario nao encontrado";
        } else if (error.message.includes("network")) {
          errorMessage = "Erro de conexao. Verifique sua internet.";
        }
        return { success: false, error: errorMessage };
      }

      if (data.user && data.session) {
        // Save session to localStorage manually
        const sessionData = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          expires_in: data.session.expires_in,
          token_type: data.session.token_type,
          user: data.user,
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));

        // Upsert profile and get data in single query
        const fullName = data.user.user_metadata?.full_name ||
                        data.user.user_metadata?.name ||
                        data.user.email?.split("@")[0] || "Usuario";

        // Pegar telefone do metadata (salvo no cadastro)
        const phoneFromMetadata = data.user.user_metadata?.phone || null;
        console.log("ðŸ“± LOGIN - Phone do metadata:", phoneFromMetadata, "| Metadata:", data.user.user_metadata);

        // Check if profile exists first (preserves is_admin)
        let { data: profile } = await getSupabase()
          .from("profiles")
          .select("*")
          .eq("user_id", data.user.id)
          .single();

        // Only create if doesn't exist
        if (!profile) {
          console.log("ðŸ“± LOGIN - Perfil NÃƒO existe, criando com phone:", phoneFromMetadata);
          const { data: newProfile } = await getSupabase()
            .from("profiles")
            .insert({
              user_id: data.user.id,
              full_name: fullName,
              phone: phoneFromMetadata,
            })
            .select("*")
            .single();
          profile = newProfile;
        } else if (!profile.phone && phoneFromMetadata) {
          // Se perfil existe mas nÃ£o tem telefone, atualizar
          console.log("ðŸ“± LOGIN - Perfil existe SEM phone, atualizando com:", phoneFromMetadata);
          await getSupabase()
            .from("profiles")
            .update({ phone: phoneFromMetadata })
            .eq("user_id", data.user.id);
          profile.phone = phoneFromMetadata;
        } else {
          console.log("ðŸ“± LOGIN - Perfil jÃ¡ tem phone:", profile.phone);
        }

        // Build user data from profile directly
        const name = profile?.full_name || fullName;
        const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
        const planNames: Record<string, string> = { free: "Grátis", essential: "Mensal", pro: "Anual", admin: "Admin" };
        const userPlan = profile?.is_admin ? "admin" : (profile?.plan || "free");
        const trialStatus = profile?.is_admin ? { isInTrial: false, trialEndsAt: null } : checkIsInTrial(profile?.plan_started_at, profile?.created_at, userPlan);

        const isAdmin = profile?.is_admin || false;
        setUser({
          id: data.user.id,
          name,
          email: data.user.email || "",
          initials,
          plan: planNames[userPlan] || "Grátis",
          planStatus: profile?.plan_status || "active",
          company: profile?.company_name || "",
          isAdmin,
          isInTrial: trialStatus.isInTrial,
          trialEndsAt: trialStatus.trialEndsAt,
          phoneVerified: profile?.phone_verified || false,
        });
        console.log("ðŸ“± LOGIN - Trial status:", trialStatus.isInTrial);
        return { success: true, isAdmin };
      }

      return { success: false, error: "Erro ao fazer login" };
    } catch (error) {
      return { success: false, error: "Erro de conexao. Tente novamente." };
    }
  };

  const logout = useCallback(async () => {
    clearStoredSession();
    setUser(null);
  }, []);

  const register = async (name: string, email: string, password: string, phone?: string): Promise<{ success: boolean; error?: string; needsConfirmation?: boolean }> => {
    console.log("ðŸ“± CADASTRO - Phone recebido:", phone);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            name,
            phone: phone || "",
          },
        },
      });

      if (error) {
        let errorMessage = error.message;
        if (error.message.includes("already registered")) {
          errorMessage = "Este email ja esta cadastrado";
        } else if (error.message.includes("Password should be")) {
          errorMessage = "A senha deve ter pelo menos 6 caracteres";
        } else if (error.message.includes("Invalid email")) {
          errorMessage = "Email invalido";
        } else if (error.message.includes("rate limit") || error.message.includes("Too many")) {
          errorMessage = "Muitas tentativas. Aguarde alguns minutos.";
        } else if (error.message.includes("security purposes")) {
          errorMessage = "Aguarde alguns segundos antes de tentar novamente.";
        }
        return { success: false, error: errorMessage };
      }

      // IMPORTANTE: Supabase não retorna erro quando email já existe (segurança anti-enumeration)
      // Em vez disso, retorna user com identities vazio
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        console.log("📱 CADASTRO - Email já existe (identities vazio)");
        return { success: false, error: "Este email ja esta cadastrado. Tente fazer login." };
      }

      // User created but needs email confirmation
      if (data.user && !data.session) {
        // Telefone jÃ¡ estÃ¡ salvo no user_metadata durante o signUp
        // O RLS bloqueia update sem sessÃ£o, entÃ£o vamos confiar no metadata
        // No login, o telefone serÃ¡ recuperado do metadata e salvo no perfil
        console.log("ðŸ“± CADASTRO - ConfirmaÃ§Ã£o necessÃ¡ria. Phone salvo no metadata:", phone);
        console.log("ðŸ“± CADASTRO - User metadata:", data.user.user_metadata);

        // ✅ TRACKING removido daqui - será disparado no Cadastro.tsx após confirmação
        // Evita duplicação de eventos Lead

        return { success: true, needsConfirmation: true };
      }

      if (data.user && data.session) {
        // Save session to localStorage manually
        const sessionData = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          expires_in: data.session.expires_in,
          token_type: data.session.token_type,
          user: data.user,
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));

        // Create or update profile with name and phone
        // Se forneceu telefone, marcar como verificado (não mostra modal)
        // Se não forneceu, phone_verified=false (mostra modal opcional)
        await getSupabase()
          .from("profiles")
          .upsert({
            user_id: data.user.id,
            full_name: name,
            phone: phone || null,
            phone_verified: !!phone,
          }, { onConflict: "user_id" });

        const userData = await getUserData(data.user);
        setUser(userData);
        return { success: true };
      }

      return { success: false, error: "Erro ao criar conta" };
    } catch (error) {
      return { success: false, error: "Erro de conexao. Tente novamente." };
    }
  };

  const resetPassword = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        let errorMessage = error.message;
        if (error.message.includes("rate limit") || error.message.includes("security purposes")) {
          errorMessage = "Aguarde alguns segundos antes de tentar novamente.";
        } else if (error.message.includes("User not found")) {
          errorMessage = "Email nao encontrado";
        } else if (error.message.includes("Invalid email")) {
          errorMessage = "Email invalido";
        }
        return { success: false, error: errorMessage };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: "Erro de conexao. Tente novamente." };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        register,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}




