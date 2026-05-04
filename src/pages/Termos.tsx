import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Termos() {
  return (
    <div className="min-h-screen bg-muted py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>

        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-8 md:p-12">
          <h1 className="text-3xl font-display font-bold mb-2">Termos de Uso</h1>
          <p className="text-muted-foreground mb-8">Última atualização: Janeiro de 2026</p>

          <div className="prose prose-sm max-w-none">
            <h2 className="text-xl font-semibold mt-8 mb-4">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground mb-4">
              Ao acessar e usar o OrçaFácil, você concorda em cumprir e estar vinculado a estes
              Termos de Uso. Se você não concordar com qualquer parte destes termos, não poderá
              acessar o serviço.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground mb-4">
              O OrçaFácil é uma plataforma SaaS (Software as a Service) que permite a prestadores
              de serviço criar, gerenciar e enviar orçamentos e faturas profissionais para seus
              clientes, além de receber pagamentos via Pix e cartão.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. Cadastro e Conta</h2>
            <p className="text-muted-foreground mb-4">
              Para utilizar nossos serviços, você deve criar uma conta fornecendo informações
              verdadeiras e atualizadas. Você é responsável por manter a confidencialidade de
              sua senha e por todas as atividades realizadas em sua conta.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">4. Uso Aceitável</h2>
            <p className="text-muted-foreground mb-4">
              Você concorda em usar o OrçaFácil apenas para fins legais e de acordo com estes
              Termos. Você não deve:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Violar qualquer lei ou regulamento aplicável</li>
              <li>Enviar conteúdo ilegal, ofensivo ou prejudicial</li>
              <li>Tentar acessar áreas não autorizadas do sistema</li>
              <li>Interferir no funcionamento do serviço</li>
              <li>Usar o serviço para enviar spam ou comunicações não solicitadas</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">5. Propriedade Intelectual</h2>
            <p className="text-muted-foreground mb-4">
              Todo o conteúdo, recursos e funcionalidades do OrçaFácil são de propriedade
              exclusiva da empresa e estão protegidos por leis de propriedade intelectual.
              O uso do serviço não lhe concede nenhum direito de propriedade sobre o mesmo.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">6. Planos e Pagamentos</h2>
            <p className="text-muted-foreground mb-4">
              Oferecemos diferentes planos de assinatura. Os valores e recursos de cada plano
              estão disponíveis em nossa página de preços. Pagamentos são processados de forma
              segura através de nossos parceiros de pagamento.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">7. Cancelamento e Reembolso</h2>
            <p className="text-muted-foreground mb-4">
              Você pode cancelar sua assinatura a qualquer momento. Oferecemos garantia de
              reembolso de 7 dias para novos assinantes. Após esse período, não há reembolso
              para o período restante da assinatura.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">8. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground mb-4">
              O OrçaFácil é fornecido "como está", sem garantias de qualquer tipo. Não nos
              responsabilizamos por quaisquer danos diretos, indiretos, incidentais ou
              consequenciais decorrentes do uso do serviço.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">9. Modificações dos Termos</h2>
            <p className="text-muted-foreground mb-4">
              Reservamo-nos o direito de modificar estes Termos a qualquer momento.
              Alterações significativas serão comunicadas por e-mail ou através do próprio
              serviço. O uso continuado após as modificações constitui aceitação dos novos termos.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">10. Contato</h2>
            <p className="text-muted-foreground mb-4">
              Para dúvidas sobre estes Termos de Uso, entre em contato conosco através do
              e-mail: suporte@jardinei.com.br
            </p>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link to="/privacidade" className="text-primary hover:underline text-sm">
            Ver Política de Privacidade
          </Link>
        </div>
      </div>
    </div>
  );
}
