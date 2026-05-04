import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function EsqueciSenha() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError("E-mail é obrigatório");
      return;
    }

    if (!validateEmail(email)) {
      setError("E-mail inválido");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await resetPassword(email);
      if (result.success) {
        setEmailSent(true);
        toast.success("E-mail enviado com sucesso!");
      } else {
        toast.error(result.error || "Erro ao enviar e-mail. Tente novamente.");
      }
    } catch {
      toast.error("Erro ao enviar e-mail. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  // Tela de sucesso
  if (emailSent) {
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
              Verifique seu e-mail
            </h2>

            <p className="text-muted-foreground mb-6">
              Enviamos um link de recuperação para <strong>{email}</strong>.
              Verifique sua caixa de entrada e siga as instruções.
            </p>

            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ArrowLeft size={16} />
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Formulário de recuperação
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
            Esqueceu sua senha?
          </h2>
          <p className="text-muted-foreground mb-8">
            Digite seu e-mail para receber um link de recuperação
          </p>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  className={`pl-10 ${error ? "border-destructive" : ""}`}
                  disabled={isLoading}
                  autoFocus
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
                  Enviando...
                </>
              ) : (
                "Enviar link de recuperação"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Lembrou sua senha?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
