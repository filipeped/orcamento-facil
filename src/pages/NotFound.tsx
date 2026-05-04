import { Link } from "react-router-dom";
import { ArrowLeft, Leaf, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-white to-white flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link to="/">
          <Logo size="md" />
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="text-center max-w-lg">
          {/* Ilustração */}
          <div className="relative mb-8">
            <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-16 h-16 text-primary/30" />
            </div>
            {/* Folhinhas decorativas */}
            <Leaf className="absolute top-0 right-1/4 w-8 h-8 text-primary/40 rotate-45 animate-pulse" />
            <Leaf className="absolute bottom-4 left-1/4 w-6 h-6 text-primary/30 -rotate-12" />
          </div>

          {/* Texto */}
          <h1 className="text-8xl font-bold text-primary mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-neutral-800 mb-3">
            Eita! Essa página se perdeu no jardim
          </h2>
          <p className="text-neutral-500 mb-10 max-w-sm mx-auto">
            Não encontramos o que você procura. Que tal voltar para um lugar seguro?
          </p>

          {/* Botão */}
          <Button
            size="lg"
            className="rounded-full bg-primary hover:bg-primary/90"
            asChild
          >
            <Link to="/" className="gap-2">
              <ArrowLeft size={18} />
              Voltar ao site
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
