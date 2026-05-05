import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Privacidade() {
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
          <h1 className="text-3xl font-display font-bold mb-2">Política de Privacidade</h1>
          <p className="text-muted-foreground mb-8">Última atualização: Janeiro de 2026</p>

          <div className="prose prose-sm max-w-none">
            <h2 className="text-xl font-semibold mt-8 mb-4">1. Informações que Coletamos</h2>
            <p className="text-muted-foreground mb-4">
              Coletamos informações que você nos fornece diretamente ao criar uma conta,
              incluindo:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Nome completo e dados de contato</li>
              <li>Endereço de e-mail e número de telefone</li>
              <li>Informações da empresa (CNPJ, endereço)</li>
              <li>Dados de pagamento (processados por parceiros seguros)</li>
              <li>Conteúdo das propostas criadas na plataforma</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. Como Usamos suas Informações</h2>
            <p className="text-muted-foreground mb-4">
              Utilizamos as informações coletadas para:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Fornecer e manter nossos serviços</li>
              <li>Processar transações e enviar confirmações</li>
              <li>Enviar comunicações sobre o serviço</li>
              <li>Melhorar e personalizar sua experiência</li>
              <li>Fornecer suporte ao cliente</li>
              <li>Detectar e prevenir fraudes</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. Compartilhamento de Dados</h2>
            <p className="text-muted-foreground mb-4">
              Não vendemos suas informações pessoais. Podemos compartilhar dados apenas nas
              seguintes situações:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Com provedores de serviços que nos auxiliam (hospedagem, pagamentos)</li>
              <li>Quando exigido por lei ou ordem judicial</li>
              <li>Para proteger nossos direitos e segurança</li>
              <li>Com seu consentimento explícito</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">4. Segurança dos Dados</h2>
            <p className="text-muted-foreground mb-4">
              Implementamos medidas de segurança técnicas e organizacionais para proteger
              suas informações, incluindo:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
              <li>Criptografia de dados em repouso</li>
              <li>Controles de acesso rigorosos</li>
              <li>Monitoramento contínuo de segurança</li>
              <li>Backups regulares</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">5. Seus Direitos (LGPD)</h2>
            <p className="text-muted-foreground mb-4">
              De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem os seguintes
              direitos:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Confirmar a existência de tratamento de dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar anonimização ou eliminação de dados</li>
              <li>Revogar consentimento a qualquer momento</li>
              <li>Solicitar portabilidade dos dados</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">6. Cookies e Tecnologias</h2>
            <p className="text-muted-foreground mb-4">
              Utilizamos cookies e tecnologias similares para:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>Manter você conectado à sua conta</li>
              <li>Lembrar suas preferências</li>
              <li>Analisar o uso da plataforma</li>
              <li>Melhorar nossos serviços</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              Você pode configurar seu navegador para recusar cookies, mas isso pode afetar
              algumas funcionalidades do serviço.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">7. Retenção de Dados</h2>
            <p className="text-muted-foreground mb-4">
              Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário
              para fornecer nossos serviços. Após o encerramento da conta, podemos reter
              dados por um período adicional conforme exigido por lei ou para fins legítimos.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">8. Menores de Idade</h2>
            <p className="text-muted-foreground mb-4">
              Nossos serviços não são direcionados a menores de 18 anos. Não coletamos
              intencionalmente dados de menores. Se tomarmos conhecimento de tal coleta,
              excluiremos as informações imediatamente.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">9. Alterações nesta Política</h2>
            <p className="text-muted-foreground mb-4">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos
              sobre mudanças significativas por e-mail ou através de aviso destacado na
              plataforma.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">10. Contato</h2>
            <p className="text-muted-foreground mb-4">
              Para questões sobre esta Política de Privacidade ou para exercer seus direitos,
              entre em contato:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-2">
              <li>E-mail: privacidade@fechaqui.com</li>
              <li>Encarregado de Dados (DPO): dpo@fechaqui.com</li>
            </ul>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link to="/termos" className="text-primary hover:underline text-sm">
            Ver Termos de Uso
          </Link>
        </div>
      </div>
    </div>
  );
}
