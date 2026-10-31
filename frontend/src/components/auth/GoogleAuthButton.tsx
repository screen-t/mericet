import { useState } from "react";
import { Button } from "@/components/ui/button";
import { initiateGoogleOAuth, OAuthOptions } from "@/lib/auth-oauth";
import { useToast } from "@/hooks/use-toast";

export interface GoogleAuthButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  redirectTo?: string;
  buttonText?: string;
}

export function GoogleAuthButton({
  onSuccess,
  onError,
  disabled = false,
  className = "",
  size = "lg",
  redirectTo,
  buttonText = "Continue with Google",
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    if (loading || disabled) return;

    setLoading(true);
    try {
      const options: OAuthOptions = {};
      if (redirectTo) {
        options.redirectTo = redirectTo;
      }

      await initiateGoogleOAuth(options);
      onSuccess?.();
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      onError?.(errorObj);
      toast({
        title: "Google Authentication Error",
        description: errorObj.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-label="Continue with Google"
      aria-busy={loading}
      className={`w-full gap-2 transition-all duration-150 relative ${className}`}
    >
      {loading ? (
        <>
          <div
            className="h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full"
            aria-hidden="true"
          />
          <span>Connecting to Google…</span>
        </>
      ) : (
        <>
          <svg
            className="h-5 w-5 shrink-0"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>{buttonText}</span>
        </>
      )}
    </Button>
  );
}
