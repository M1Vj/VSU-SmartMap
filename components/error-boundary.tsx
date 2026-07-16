"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { captureClientLogEvent } from "@/components/observability/app-logging-provider";

interface Props {
  children?: ReactNode;
  wrapperClassName?: string;
  className?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    captureClientLogEvent({
      level: "fatal",
      eventName: "react.component_error",
      message: error.message || "React component error boundary rendered",
      metadata: {
        name: error.name,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      },
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className={cn("flex min-h-[400px] flex-col items-center justify-center gap-4 text-center p-6", this.props.wrapperClassName, this.props.className)}>
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold tracking-tight">Something went wrong</h3>
            <p className="text-sm text-muted-foreground w-full max-w-md mx-auto">
              {this.state.error?.message || "An unexpected error occurred. Please try again."}
            </p>
          </div>
          <Button onClick={this.handleReset} variant="outline">
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
