import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  FileText,
  Plus,
  Receipt,
  Users,
  BarChart3,
  Settings,
  Wallet,
  CalendarDays,
  Package,
} from "lucide-react";
import { useProposals } from "@/contexts/ProposalsContext";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { proposals } = useProposals();

  // Atalho ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  // Top 5 propostas mais recentes pra search
  const recentProposals = proposals.slice(0, 5);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="O que você quer fazer? (orçamento, cliente, configurações...)" />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>

        <CommandGroup heading="Criar">
          <CommandItem onSelect={() => go("/orcamentos/novo")}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Novo orçamento</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/faturas/nova")}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Nova fatura</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/despesas/nova")}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Nova despesa</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navegar">
          <CommandItem onSelect={() => go("/orcamentos")}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Orçamentos</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/faturas")}>
            <Receipt className="mr-2 h-4 w-4" />
            <span>Faturas</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/clientes")}>
            <Users className="mr-2 h-4 w-4" />
            <span>Clientes</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/meus-itens")}>
            <Package className="mr-2 h-4 w-4" />
            <span>Meus itens</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/despesas")}>
            <Wallet className="mr-2 h-4 w-4" />
            <span>Despesas</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/agenda")}>
            <CalendarDays className="mr-2 h-4 w-4" />
            <span>Agenda</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/relatorios")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Relatórios</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/configuracoes")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configurações</span>
          </CommandItem>
        </CommandGroup>

        {recentProposals.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Propostas recentes">
              {recentProposals.map((p) => (
                <CommandItem
                  key={p.id}
                  onSelect={() => go(`/orcamentos/${p.id}`)}
                  value={`${p.client.name} ${p.title} ${p.shortId || ""}`}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">{p.client.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{p.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
