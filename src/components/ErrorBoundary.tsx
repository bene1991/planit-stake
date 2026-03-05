import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Algo deu errado</h2>
                    <p className="max-w-md text-sm text-muted-foreground">
                        Ocorreu um erro inesperado. Tente recarregar a página ou clique no botão abaixo.
                    </p>
                    {this.state.error && (
                        <pre className="max-w-lg overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
                            {this.state.error.message}
                        </pre>
                    )}
                    <button
                        type="button"
                        onClick={this.handleRetry}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Tentar novamente
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
