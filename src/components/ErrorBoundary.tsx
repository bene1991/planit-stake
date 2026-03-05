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

function isChunkLoadError(error: Error): boolean {
    const msg = error.message?.toLowerCase() || '';
    return (
        msg.includes('failed to fetch dynamically imported module') ||
        msg.includes('loading chunk') ||
        msg.includes('loading css chunk') ||
        msg.includes('dynamically imported module') ||
        msg.includes('unexpected token') || // Often happens when HTML is served instead of JS
        msg.includes('script error') ||
        (error.name === 'TypeError' && msg.includes('failed to fetch'))
    );
}

const RELOAD_KEY = 'eb_chunk_reload';

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);

        // Auto-reload once for chunk load errors (e.g. after Vercel redeploy)
        if (isChunkLoadError(error)) {
            const lastReload = sessionStorage.getItem(RELOAD_KEY);
            const now = Date.now();

            // Only auto-reload if we haven't reloaded in the last 15 seconds
            // This prevents an infinite loop if the error persists
            if (!lastReload || now - Number(lastReload) > 15_000) {
                console.warn('[ErrorBoundary] Chunk load error detected. Attempting auto-reload...');
                sessionStorage.setItem(RELOAD_KEY, String(now));

                // Clear Service Worker cache if possible
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
                }

                // Small delay to ensure session storage is updated and cache clear message is sent
                setTimeout(() => {
                    window.location.reload();
                }, 500);
                return;
            } else {
                console.error('[ErrorBoundary] Repeated chunk error. Stopping auto-reload to avoid loop.');
            }
        }
    }

    handleRetry = () => {
        if (this.state.error && isChunkLoadError(this.state.error)) {
            // For chunk errors a full reload is needed to get fresh assets
            window.location.reload();
            return;
        }
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            const isChunk = this.state.error ? isChunkLoadError(this.state.error) : false;

            return (
                <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">
                        {isChunk ? 'Nova versão disponível' : 'Algo deu errado'}
                    </h2>
                    <p className="max-w-md text-sm text-muted-foreground">
                        {isChunk
                            ? 'Uma nova versão do app foi publicada. Clique abaixo para recarregar.'
                            : 'Ocorreu um erro inesperado. Tente recarregar a página ou clique no botão abaixo.'}
                    </p>
                    {!isChunk && this.state.error && (
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
                        {isChunk ? 'Recarregar página' : 'Tentar novamente'}
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
