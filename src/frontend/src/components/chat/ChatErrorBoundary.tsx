import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chat Error Boundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    // Force reload the chat by refreshing the page
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Chat Error
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Something went wrong with the chat interface. This may be due to a 
              connection issue or data loading problem.
            </p>
            <div className="space-y-2">
              <Button
                onClick={this.handleRetry}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={this.handleReload}
                size="sm"
                className="w-full"
              >
                Reload Chat
              </Button>
            </div>
            {this.state.error && (
              <details className="mt-4 text-xs text-left">
                <summary className="cursor-pointer text-gray-500">
                  Error Details
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                  {this.state.error.message}
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