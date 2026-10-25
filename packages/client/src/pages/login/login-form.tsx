"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zdocs/client-component";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@zdocs/client-component";
import { Alert, AlertDescription } from "@zdocs/client-component";
import { Separator } from "@zdocs/client-component";
import { ForgotPasswordForm } from "./forgot-password-form";
import { useLogUserJourneyEvent } from "../../utilities/api/logUserJourneyEventApi";
import { trackSignupConversion } from "../../utilities/trackGoogleAdsConversion";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof formSchema>;

export function LoginForm({
  prefillEmail,
  onPrefillConsumed,
}: {
  prefillEmail?: string;
  onPrefillConsumed?: () => void;
}) {
  const t = useTranslations("loginForm");
  const searchParams = useSearchParams();
  const { logEvent } = useLogUserJourneyEvent();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema as any),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const hasLoggedPageView = useRef(false);
  useEffect(() => {
    if (hasLoggedPageView.current) return;
    hasLoggedPageView.current = true;
    logEvent({
      eventType: "login_page_viewed",
      eventData: {
        hasPrefillEmail: !!prefillEmail,
      },
    });
  }, [logEvent, prefillEmail]);

  // Handle auth errors from URL params
  useEffect(() => {
    const errorParam = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");

    if (errorParam === "OAUTH_ACCOUNT_REQUIRED") {
      setError(t("useGoogleLogin"));
      logEvent({
        eventType: "login_error",
        eventData: {
          errorType: "OAUTH_ACCOUNT_REQUIRED",
          source: "url_params",
        },
      });
    } else if (errorParam === "USER_NOT_FOUND") {
      setError(t("userNotFound"));
      logEvent({
        eventType: "login_error",
        eventData: {
          errorType: "USER_NOT_FOUND",
          source: "url_params",
        },
      });
    } else if (errorParam === "WRONG_PASSWORD_OR_OAUTH") {
      setError(t("wrongPasswordOrOAuth"));
      logEvent({
        eventType: "login_error",
        eventData: {
          errorType: "WRONG_PASSWORD_OR_OAUTH",
          source: "url_params",
        },
      });
    } else if (errorParam === "OAuthAccountNotLinked") {
      setError(t("accountExistsUsePassword"));
      logEvent({
        eventType: "login_error",
        eventData: {
          errorType: "OAuthAccountNotLinked",
          source: "url_params",
        },
      });
    } else if (errorParam === "CredentialsSignin") {
      setError(t("invalidCredentials"));
      logEvent({
        eventType: "login_error",
        eventData: {
          errorType: "CredentialsSignin",
          source: "url_params",
        },
      });
    } else if (errorParam === "OAuthCallback" && errorDesc?.includes("Already found an entry")) {
      setError(t("accountExistsUsePassword"));
      logEvent({
        eventType: "login_error",
        eventData: {
          errorType: "OAuthCallback_AlreadyFound",
          source: "url_params",
        },
      });
    } else if (errorParam === "OAuthCallback") {
      setError(t("googleLoginFailed"));
      logEvent({
        eventType: "login_error",
        eventData: {
          errorType: "OAuthCallback",
          source: "url_params",
        },
      });
    }
  }, [searchParams, t, logEvent]);

  useEffect(() => {
    if (!prefillEmail) return;

    form.setValue("email", prefillEmail, { shouldDirty: true });
    form.setValue("password", "", { shouldDirty: false });
    setError(null);
    setIsPending(false);
    form.setFocus("password");
    onPrefillConsumed?.();
  }, [prefillEmail, form, onPrefillConsumed]);

  async function handleGoogleSignIn() {
    setError(null);
    setIsGooglePending(true);
    logEvent({
      eventType: "login_google_clicked",
    });
    try {
      sessionStorage.setItem("oauth_in_progress", "google");
      await signIn("cognito", { callbackUrl: "/" }, { identity_provider: "Google" });
    } catch (err) {
      sessionStorage.removeItem("oauth_in_progress");
      setError(t("googleLoginFailed"));
      setIsGooglePending(false);
      logEvent({
        eventType: "login_error",
        eventData: {
          errorType: "google_signin_exception",
          method: "google",
        },
      });
    }
  }

  async function onSubmit(data: FormData) {
    setError(null);
    setIsPending(true);

    logEvent({
      eventType: "login_form_submitted",
      eventData: {
        method: "email_password",
        email: data.email,
      },
    });

    try {
      // Use credentials provider which authenticates against Cognito
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        const errorUrl = result.url || "";
        let errorType = "unknown";

        // Check specific error types
        if (result.error === "OAUTH_ACCOUNT_REQUIRED" || errorUrl.includes("OAUTH_ACCOUNT_REQUIRED")) {
          setError(t("useGoogleLogin"));
          errorType = "OAUTH_ACCOUNT_REQUIRED";
        } else if (result.error === "USER_NOT_FOUND" || errorUrl.includes("USER_NOT_FOUND")) {
          setError(t("userNotFound"));
          errorType = "USER_NOT_FOUND";
        } else if (result.error === "WRONG_PASSWORD_OR_OAUTH" || errorUrl.includes("WRONG_PASSWORD_OR_OAUTH")) {
          setError(t("wrongPasswordOrOAuth"));
          errorType = "WRONG_PASSWORD_OR_OAUTH";
        } else {
          setError(t("invalidCredentials"));
          errorType = "invalidCredentials";
        }
        setIsPending(false);
        logEvent({
          eventType: "login_error",
          eventData: {
            errorType,
            method: "email_password",
            email: data.email,
          },
        });
      } else if (result?.ok) {
        logEvent({
          eventType: "login_success",
          eventData: {
            method: "email_password",
            email: data.email,
          },
        });
        trackSignupConversion();
        window.location.href = "/";
      }
    } catch (err) {
      setError(t("error"));
      setIsPending(false);
      logEvent({
        eventType: "login_error",
        eventData: {
          errorType: "exception",
          method: "email_password",
          email: data.email,
        },
      });
    }
  }

  if (showForgotPassword) {
    return (
      <ForgotPasswordForm
        onBackToLogin={() => {
          setShowForgotPassword(false);
          setError(null);
        }}
      />
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-card border-border" data-testid="login-form-card">
      <CardHeader>
        <CardTitle className="text-2xl text-foreground">{t("title")}</CardTitle>
        <CardDescription className="text-muted-foreground">{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive" data-testid="login-error-alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Google Sign In Button */}
        <Button
          type="button"
          variant="outline"
          className="w-full border-border text-foreground hover:bg-accent"
          onClick={handleGoogleSignIn}
          disabled={isGooglePending || isPending}
          data-testid="google-signin-btn"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {isGooglePending ? t("signingInWithGoogle") : t("signInWithGoogle")}
        </Button>

        {/* Separator */}
        <div className="relative" data-testid="login-separator">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">{t("or")}</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">{t("email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      data-testid="login-email-input"
                      className="border-input focus:border-ring focus:ring-ring"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-foreground">{t("password")}</FormLabel>
                    <button
                      type="button"
                      onClick={() => {
                        logEvent({
                          eventType: "login_forgot_password_clicked",
                        });
                        setShowForgotPassword(true);
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground underline"
                      data-testid="forgot-password-link"
                    >
                      {t("forgotPassword")}
                    </button>
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={t("passwordPlaceholder")}
                      data-testid="login-password-input"
                      className="border-input focus:border-ring focus:ring-ring"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isPending}
              data-testid="login-submit-btn"
            >
              {isPending ? t("loggingIn") : t("loginButton")}
            </Button>
          </form>
        </Form>

        <p className="text-sm text-muted-foreground text-center">
          {t.rich("legalAgreement", {
            terms: (chunks) => (
              <a
                key="terms"
                href={`${process.env.NEXT_PUBLIC_MAIN_URL || ""}/terms`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                {chunks}
              </a>
            ),
            privacy: (chunks) => (
              <a
                key="privacy"
                href={`${process.env.NEXT_PUBLIC_MAIN_URL || ""}/privacy`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </CardContent>
    </Card>
  );
}
