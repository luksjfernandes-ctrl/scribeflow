import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      
      try {
        // Check if the error is a FirestoreErrorInfo JSON string
        const errorInfo = JSON.parse(this.state.error?.message || '');
        if (errorInfo.error && errorInfo.operationType) {
          errorMessage = `Firestore Error (${errorInfo.operationType}): ${errorInfo.error}`;
        }
      } catch (e) {
        // Not a Firestore error JSON
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full border border-[#d1d1ca]">
            <h2 className="text-2xl font-serif font-bold text-red-600 mb-4">Something went wrong</h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 bg-[#5a5a40] text-white rounded font-medium hover:bg-[#4a4a30] transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
