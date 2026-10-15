import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    try {
      // Nettoie les caches de zoom mobiles ou filtres potentiellement corrompus
      localStorage.removeItem("crm-table-zoom-mobile");
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-[#0073ea] flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              IP5
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-2">
              Affichage interrompu
            </h2>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Un problème d'affichage est survenu. Cliquez sur le bouton ci-dessous pour recharger le CRM proprement.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 bg-[#0073ea] hover:bg-[#0060c2] text-white font-semibold text-sm rounded-xl transition shadow-sm"
            >
              Recharger le CRM
            </button>
            {this.state.error?.message && (
              <p className="mt-4 text-[11px] text-gray-400 font-mono truncate">
                {this.state.error.message}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
