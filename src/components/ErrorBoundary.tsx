import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log para serviço de monitoramento (Sentry, etc.)
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-muted p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Ops! Algo deu errado
            </h2>
            <p className="text-gray-600 mb-6">
              Ocorreu um erro inesperado. Tente novamente ou recarregue a página.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={this.handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
              <Button onClick={this.handleReload}>
                Recarregar página
              </Button>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer">
                  Detalhes do erro (dev)
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
                  {this.state.error.message}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
