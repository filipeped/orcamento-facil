import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, ArrowLeft, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const processToken = async () => {
      // Process the recovery token from URL hash
      const hash = window.location.hash;
      if (hash) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");
        const errorCode = hashParams.get("error_code");
        const errorDesc = hashParams.get("error_description");

        // Check for error in URL (expired link)
        if (errorCode || errorDesc) {
          console.error("Error in URL:", errorCode, errorDesc);
          setError("O link expirou. Solicite um novo link de recuperacao.");
          setIsProcessing(false);
          return;
        }

        if (type === "recovery" && accessToken && refreshToken) {
          console.log("Recovery token found, setting session");
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("Error setting session:", error);
            setError("Link expirado ou invalido. Solicite um novo link de recuperacao.");
          } else {
            setIsReady(true);
          }
        } else {
          // No token in URL, check if there's an existing session
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setIsReady(true);
          } else {
            setError("Link expirado ou invalido. Solicite um novo link de recuperacao.");
          }
        }
      } else {
        // No hash, check existing session
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setIsReady(true);
        } else {
          setError("Link expirado ou invalido. Solicite um novo link de recuperacao.");
        }
      }
      setIsProcessing(false);
    };

    processToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isReady) {
      setError("Sessao invalida. Solicite um novo link de recuperacao.");
      return;
    }

    if (!password) {
      setError("Senha e obrigatoria");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas nao coincidem");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        // Traduzir mensagens de erro do Supabase
        let errorMessage = error.message;
        if (error.message.includes("same as your old password")) {
          errorMessage = "A nova senha deve ser diferente da senha atual";
        } else if (error.message.includes("Password should be")) {
          errorMessage = "A senha deve ter pelo menos 6 caracteres";
        } else if (error.message.includes("session")) {
          errorMessage = "Sessao expirada. Solicite um novo link de recuperacao.";
        }
        toast.error(errorMessage);
        setError(errorMessage);
      } else {
        setIsSuccess(true);
        toast.success("Senha alterada com sucesso!");
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    } catch {
      toast.error("Erro ao alterar senha. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-muted flex flex-col justify-center items-center py-12 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verificando link...</p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-muted flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-verde-100 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-verde-200 rounded-full blur-3xl opacity-30" />
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center mb-8">
            <Link to="/">
              <Logo size="lg" />
            </Link>
          </div>

          <div className="bg-card rounded-2xl shadow-xl border border-border p-8 text-center">
            <div className="w-16 h-16 bg-verde-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="text-primary" size={32} />
            </div>

            <h2 className="text-2xl font-display font-bold mb-4">
              Senha alterada!
            </h2>

            <p className="text-muted-foreground mb-6">
              Sua senha foi alterada com sucesso. Voce sera redirecionado para o login.
            </p>

            <Link to="/login">
              <Button className="w-full">
                Ir para o login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-verde-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-verde-200 rounded-full blur-3xl opacity-30" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-8">
          <Link to="/">
            <Logo size="lg" />
          </Link>
        </div>

        <div className="bg-card rounded-2xl shadow-xl border border-border p-8">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft size={16} />
            Voltar
          </Link>

          <h2 className="text-2xl font-display font-bold mb-2">
            Criar nova senha
          </h2>
          <p className="text-muted-foreground mb-8">
            Digite sua nova senha abaixo.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimo 6 caracteres"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  className={`pl-10 pr-10 ${error ? "border-destructive" : ""}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite novamente"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError("");
                  }}
                  className={`pl-10 ${error ? "border-destructive" : ""}`}
                  disabled={isLoading}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                "Alterar senha"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
