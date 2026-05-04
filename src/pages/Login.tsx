import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Phone, Lock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const from = location.state?.from?.pathname || "/propostas";

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/propostas", { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Detectar se input é telefone (só dígitos, parênteses, espaços, hífens)
  const isPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13 && /^[\d\s()+-]+$/.test(value.trim());
  };

  // Normalizar telefone para formato padrão (11 dígitos)
  // Aceita: +55 47 98913-6827, 5547989136827, 47 8913-6827, etc.
  const normalizePhone = (value: string): string => {
    // Remove TUDO que não é número
    let digits = value.replace(/\D/g, '');

    // Remove 55 do início se presente
    if (digits.startsWith('55')) {
      digits = digits.slice(2);
    }

    // Se tem 10 dígitos (sem o 9), adiciona o 9 após DDD
    if (digits.length === 10) {
      digits = digits.slice(0, 2) + '9' + digits.slice(2);
    }

    // Se ainda tem 11 dígitos, está ok
    // Se tem mais ou menos, retorna como está (a validação vai pegar)
    return digits;
  };

  // Buscar email real pelo telefone (para contas com email real)
  const findEmailByPhone = async (phone: string): Promise<string | null> => {
    try {
      const normalized = normalizePhone(phone);

      // Gerar variações do telefone para busca
      const variations = [
        normalized,                                    // 47989136827
        '55' + normalized,                             // 5547989136827
        normalized.slice(0, 2) + normalized.slice(3),  // 4789136827 (sem 9)
        '55' + normalized.slice(0, 2) + normalized.slice(3), // 554789136827
      ];

      // Buscar na API
      const response = await fetch('/api/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'find-email-by-phone',
          phone: normalized,
          variations
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.email) {
          console.log('📱 Email encontrado pelo telefone:', data.email);
          return data.email;
        }
      }
    } catch (error) {
      console.error('Erro ao buscar email por telefone:', error);
    }
    return null;
  };

  // Converter telefone para email interno
  const getLoginEmail = async (input: string): Promise<string> => {
    if (isPhoneInput(input)) {
      const normalized = normalizePhone(input);
      console.log('📱 Login telefone:', input, '→', normalized);

      // Primeiro tenta encontrar email real pelo telefone
      const realEmail = await findEmailByPhone(input);
      if (realEmail) {
        return realEmail;
      }

      // Fallback: email gerado pelo telefone (para contas sem email)
      return `${normalized}@jardinei.app`;
    }
    return input;
  };

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = "WhatsApp ou e-mail e obrigatorio";
    } else if (!isPhoneInput(email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "WhatsApp ou e-mail invalido";
    }

    if (!password) {
      newErrors.password = "Senha e obrigatoria";
    } else if (password.length < 6) {
      newErrors.password = "Senha deve ter pelo menos 6 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    // Buscar email (pode ser async se for telefone)
    const loginEmail = await getLoginEmail(email);
    const result = await login(loginEmail, password);

    if (result.success) {
      toast.success("Login realizado com sucesso!");
      // Admin vai direto pro painel admin
      if (result.isAdmin) {
        navigate("/admin", { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } else {
      toast.error(result.error || "Erro ao fazer login. Tente novamente.");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-jd-bg font-body text-jd-ink flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Link to="/">
            <Logo size="lg" />
          </Link>
        </div>

        {/* Card — estilo v3 terra/natureza */}
        <div className="bg-jd-surface rounded-xl border border-jd-border p-6 md:p-8 animate-card-in">
          <div className="text-center mb-8">
            <p className="text-[11px] font-medium text-jd-accent uppercase tracking-[0.28em] mb-3">
              Acesso
            </p>
            <h2 className="font-display text-[28px] md:text-[34px] text-jd-ink tracking-[-0.015em] leading-[1.1] font-medium">
              Bem-vindo <em className="italic text-jd-accent font-normal">de volta.</em>
            </h2>
            <p className="text-sm text-jd-muted mt-3 italic font-display">
              Entre com WhatsApp ou e-mail.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* WhatsApp ou Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-jd-muted">WhatsApp ou E-mail</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-jd-muted w-4 h-4 pointer-events-none" strokeWidth={1.5} />
                <Input
                  id="email"
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  className={`pl-10 h-12 rounded-xl border-jd-border text-base focus-visible:ring-0 focus-visible:border-jd-accent focus-visible:outline-none ${errors.email ? "border-red-500" : ""}`}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-xs font-medium text-jd-muted">Senha</label>
                <Link
                  to="/esqueci-senha"
                  className="text-xs text-jd-accent hover:text-jd-ink font-medium transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-jd-muted w-4 h-4 pointer-events-none" strokeWidth={1.5} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  className={`pl-10 pr-10 h-12 rounded-xl border-jd-border text-base focus-visible:ring-0 focus-visible:border-jd-accent focus-visible:outline-none ${errors.password ? "border-red-500" : ""}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-jd-muted hover:text-jd-ink transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            {/* Submit Button — verde musgo do sistema */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 mt-2 bg-jd-accent hover:opacity-90 active:scale-[0.99] disabled:bg-jd-muted disabled:opacity-50 text-white rounded-full text-[15px] font-medium transition-opacity flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          {/* Sign up link editorial */}
          <div className="mt-7 pt-6 border-t border-jd-border text-center">
            <p className="text-sm text-jd-muted">
              Ainda não assinou?{" "}
              <Link to="/checkout?plan=pro" className="text-jd-accent font-medium hover:text-jd-ink transition-colors">
                Assinar agora →
              </Link>
            </p>
          </div>
        </div>

        {/* Back to home */}
        <p className="text-center text-xs text-jd-muted mt-6">
          <Link to="/" className="hover:text-jd-ink transition-colors italic font-display">
            ← Voltar para o site
          </Link>
        </p>
      </div>
    </div>
  );
}
