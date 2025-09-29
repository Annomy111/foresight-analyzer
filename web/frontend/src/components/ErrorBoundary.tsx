import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Something went wrong
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  The application encountered an error. Please try refreshing the page.
                </p>
                {this.state.error && (
                  <details className="text-xs text-gray-500">
                    <summary className="cursor-pointer font-medium mb-2">
                      Error details
                    </summary>
                    <pre className="bg-gray-50 p-3 rounded overflow-x-auto">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
