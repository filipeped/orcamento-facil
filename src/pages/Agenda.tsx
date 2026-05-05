import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useProposals } from "@/contexts/ProposalsContext";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Agenda() {
  const { proposals } = useProposals();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Navegação do calendário
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Gerar dias do calendário
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: { date: Date; isCurrentMonth: boolean; proposals: typeof proposals }[] = [];

    // Dias do mês anterior
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false, proposals: [] });
    }

    // Dias do mês atual
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const dayProposals = proposals.filter((p) => {
        const proposalDate = new Date(p.createdAt);
        return (
          proposalDate.getDate() === date.getDate() &&
          proposalDate.getMonth() === date.getMonth() &&
          proposalDate.getFullYear() === date.getFullYear()
        );
      });
      days.push({ date, isCurrentMonth: true, proposals: dayProposals });
    }

    // Dias do próximo mês para completar a grade
    const remainingDays = 42 - days.length; // 6 semanas * 7 dias
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false, proposals: [] });
    }

    return days;
  }, [currentDate, proposals]);

  // Propostas do dia selecionado
  const selectedDayProposals = useMemo(() => {
    if (!selectedDate) return [];
    return proposals.filter((p) => {
      const proposalDate = new Date(p.createdAt);
      return (
        proposalDate.getDate() === selectedDate.getDate() &&
        proposalDate.getMonth() === selectedDate.getMonth() &&
        proposalDate.getFullYear() === selectedDate.getFullYear()
      );
    });
  }, [selectedDate, proposals]);

  // Verificar se é hoje
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Verificar se é o dia selecionado
  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const monthName = currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Estatísticas do mês
  const monthStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthProposals = proposals.filter((p) => {
      const date = new Date(p.createdAt);
      return date.getMonth() === month && date.getFullYear() === year;
    });

    const approved = monthProposals.filter((p) => p.status === "approved");

    return {
      total: monthProposals.length,
      approved: approved.length,
      revenue: approved.reduce((sum, p) => sum + p.total, 0),
    };
  }, [currentDate, proposals]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
              Agenda
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
              Visualize suas propostas
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={goToToday} className="h-8 text-xs sm:text-sm">
            Hoje
          </Button>
        </header>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-white rounded-xl sm:rounded-2xl border border-neutral-200 p-3 sm:p-5 animate-card-in">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <button
                onClick={goToPreviousMonth}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 active:bg-neutral-200 transition-colors touch-feedback btn-press"
              >
                <ChevronLeft size={18} className="sm:w-5 sm:h-5" />
              </button>
              <h2 className="text-base sm:text-lg font-semibold capitalize">{monthName}</h2>
              <button
                onClick={goToNextMonth}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-100 active:bg-neutral-200 transition-colors touch-feedback btn-press"
              >
                <ChevronRight size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Week Days Header */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-[10px] sm:text-xs font-medium text-neutral-500 py-1.5 sm:py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {calendarDays.map((day, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedDate(day.date)}
                  className={cn(
                    "aspect-square p-0.5 sm:p-1 rounded-md sm:rounded-lg text-xs sm:text-sm transition-all relative",
                    day.isCurrentMonth
                      ? "hover:bg-neutral-100 active:bg-neutral-200"
                      : "text-neutral-300",
                    isToday(day.date) && "bg-green-100 text-green-700 font-semibold",
                    isSelected(day.date) && "ring-2 ring-green-500 bg-accent/10"
                  )}
                >
                  <span className="block">{day.date.getDate()}</span>
                  {/* Indicadores de propostas */}
                  {day.proposals.length > 0 && (
                    <div className="flex justify-center gap-0.5 mt-0.5">
                      {day.proposals.slice(0, 3).map((p, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full",
                            p.status === "approved" ? "bg-green-500" :
                            p.status === "viewed" ? "bg-green-400" :
                            p.status === "sent" ? "bg-neutral-400" : "bg-neutral-300"
                          )}
                        />
                      ))}
                      {day.proposals.length > 3 && (
                        <span className="text-[6px] sm:text-[8px] text-neutral-400">+{day.proposals.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Legend - horizontal scroll on mobile */}
            <div className="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-neutral-100 overflow-x-auto pb-1">
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500" />
                <span className="text-[10px] sm:text-xs text-neutral-500">Aprovada</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-300" />
                <span className="text-[10px] sm:text-xs text-neutral-500">Visualizada</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-neutral-400" />
                <span className="text-[10px] sm:text-xs text-neutral-500">Enviada</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-neutral-300" />
                <span className="text-[10px] sm:text-xs text-neutral-500">Rascunho</span>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-3 sm:space-y-4">
            {/* Month Stats */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-neutral-200 p-3 sm:p-4 animate-card-in stagger-1">
              <h3 className="font-semibold text-neutral-900 mb-2 sm:mb-3 capitalize text-sm sm:text-base">
                {currentDate.toLocaleDateString("pt-BR", { month: "long" })}
              </h3>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-neutral-500">Propostas</span>
                  <span className="font-semibold text-sm sm:text-base">{monthStats.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-neutral-500">Aprovadas</span>
                  <span className="font-semibold text-green-600 text-sm sm:text-base">{monthStats.approved}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-neutral-500">Faturamento</span>
                  <span className="font-semibold text-green-600 text-sm sm:text-base">{formatCurrency(monthStats.revenue)}</span>
                </div>
              </div>
            </div>

            {/* Selected Day */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-neutral-200 p-3 sm:p-4 animate-card-in stagger-2">
              <h3 className="font-semibold text-neutral-900 mb-2 sm:mb-3 text-sm sm:text-base">
                {selectedDate
                  ? selectedDate.toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })
                  : "Selecione um dia"}
              </h3>

              {selectedDate && selectedDayProposals.length === 0 ? (
                <div className="text-center py-4 sm:py-6">
                  <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-300 mx-auto mb-2" />
                  <p className="text-xs sm:text-sm text-neutral-500">Nenhuma proposta neste dia</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayProposals.map((proposal) => (
                    <Link
                      key={proposal.id}
                      to={`/propostas/${proposal.id}`}
                      className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 active:bg-neutral-200 transition-colors touch-feedback"
                    >
                      <div className={cn(
                        "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center",
                        proposal.status === "approved" ? "bg-green-100" :
                        proposal.status === "viewed" ? "bg-accent/10" :
                        proposal.status === "sent" ? "bg-neutral-100" : "bg-neutral-200"
                      )}>
                        {proposal.status === "approved" ? (
                          <CheckCircle size={14} className="sm:w-4 sm:h-4 text-green-600" />
                        ) : proposal.status === "viewed" ? (
                          <Eye size={14} className="sm:w-4 sm:h-4 text-green-500" />
                        ) : proposal.status === "sent" ? (
                          <Clock size={14} className="sm:w-4 sm:h-4 text-neutral-500" />
                        ) : (
                          <FileText size={14} className="sm:w-4 sm:h-4 text-neutral-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm text-neutral-900 truncate">
                          {proposal.client.name}
                        </p>
                        <p className="text-[10px] sm:text-xs text-neutral-500">
                          {formatCurrency(proposal.total)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
