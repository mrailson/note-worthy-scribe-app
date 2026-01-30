import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isRetrying: boolean;
}

/**
 * Error boundary that catches chunk loading failures (dynamic imports)
 * and provides automatic or manual refresh options.
 */
class ChunkLoadErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    isRetrying: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Check if this is a chunk loading error
    const isChunkError = 
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('ChunkLoadError');
    
    if (isChunkError) {
      return { hasError: true };
    }
    
    // Re-throw non-chunk errors
    throw error;
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Chunk loading error caught:', error, errorInfo);
    
    // Check if we've already tried to reload recently
    const lastReload = sessionStorage.getItem('chunk_error_reload');
    const now = Date.now();
    
    if (!lastReload || now - parseInt(lastReload, 10) > 30000) {
      // Auto-reload once if we haven't reloaded in the last 30 seconds
      sessionStorage.setItem('chunk_error_reload', now.toString());
      window.location.reload();
    }
  }

  private handleManualReload = () => {
    this.setState({ isRetrying: true });
    // Clear cache and reload
    sessionStorage.removeItem('chunk_error_reload');
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
          <div className="text-center space-y-4 max-w-md">
            {this.state.isRetrying ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground">Refreshing...</p>
              </>
            ) : (
              <>
                <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto" />
                <h2 className="text-xl font-semibold">Page Update Available</h2>
                <p className="text-muted-foreground">
                  A newer version of the app is available. Please refresh to continue.
                </p>
                <Button onClick={this.handleManualReload} className="mt-4">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Page
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ChunkLoadErrorBoundary };
