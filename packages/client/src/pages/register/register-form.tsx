"use client";

import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zdocs/client-component";
import { Alert, AlertDescription } from "@zdocs/client-component";
import { Separator } from "@zdocs/client-component";
import { trackSignupConversion } from "../../utilities/trackGoogleAdsConversion";

type RegisterData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type VerifyData = {
  code: string;
};

export function RegisterForm({
  onRegistered,
}: {
  onRegistered?: (email: string) => void;
}) {
  const t = useTranslations("registerForm");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const [step, setStep] = useState<"register" | "verify">("register");
  const [email, setEmail] = useState<string>("");

  async function handleGoogleSignUp() {
    setError(null);
    setIsGooglePending(true);
    try {
      await signIn("cognito", { callbackUrl: "/" }, { identity_provider: "Google" });
    } catch (err) {
      setError(t("error"));
      setIsGooglePending(false);
    }
  }

  const registerSchema = useMemo(
    () =>
      z
        .object({
          name: z.string().min(2, { message: t("nameMinLength") }),
          email: z.string().email({ message: t("emailInvalid") }),
          password: z.string().min(8, { message: t("passwordMinLength") }),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t("passwordsDoNotMatch"),
          path: ["confirmPassword"],
        }),
    [t]
  );

  const verifySchema = useMemo(
    () =>
      z.object({
        code: z.string().min(6, { message: t("verificationCodeInvalid") }),
      }),
    [t]
  );

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema as any),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const verifyForm = useForm<VerifyData>({
    resolver: zodResolver(verifySchema as any),
    defaultValues: {
      code: "",
    },
  });

  async function onRegister(values: RegisterData) {
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("error"));
        return;
      }

      if (data.requiresVerification) {
        setEmail(data.email);
        setStep("verify");
      } else {
        trackSignupConversion();
        onRegistered?.(String(values.email || "").toLowerCase());
      }
    } catch (error) {
      setError(t("error"));
    } finally {
      setIsPending(false);
    }
  }

  async function onVerify(values: VerifyData) {
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code: values.code,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("error"));
        return;
      }

      const verifiedEmail = String(email || "").toLowerCase();
      trackSignupConversion();
      onRegistered?.(verifiedEmail);

      // Reset local state so if user comes back to register tab, it starts fresh
      setStep("register");
      setEmail("");
      verifyForm.reset({ code: "" });
      registerForm.reset({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
    } catch (error) {
      setError(t("error"));
    } finally {
      setIsPending(false);
    }
  }

  if (step === "verify") {
    return (
      <Card className="w-full max-w-md mx-auto bg-white border border-[#DDDDDD]" data-testid="verify-form-card">
        <CardHeader>
          <CardTitle className="text-2xl text-[#333333]">{t("verifyTitle")}</CardTitle>
          <CardDescription className="text-[#666666]">{t("verifyDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" data-testid="verify-error-alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-[#666666]">
            {t("verificationSent", { email })}
          </p>

          <Form {...verifyForm}>
            <form
              onSubmit={verifyForm.handleSubmit(onVerify)}
              className="space-y-4"
            >
              <FormField
                control={verifyForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#333333]">{t("verificationCode")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123456"
                        maxLength={6}
                        data-testid="verify-code-input"
                        className="border-[#DDDDDD] focus:border-[#EF6F4B] focus:ring-[#EF6F4B]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-[#3C4B5F] text-white hover:bg-[#2d3847]"
                disabled={isPending}
                data-testid="verify-submit-btn"
              >
                {isPending ? t("verifying") : t("verifyButton")}
              </Button>
            </form>
          </Form>

          <Button
            variant="ghost"
            className="w-full text-[#666666] hover:text-[#333333] hover:bg-[#F8F8F8]"
            onClick={() => setStep("register")}
            data-testid="back-to-register-btn"
          >
            {t("backToRegister")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-white border border-[#DDDDDD]" data-testid="register-form-card">
      <CardHeader>
        <CardTitle className="text-2xl text-[#333333]">{t("title")}</CardTitle>
        <CardDescription className="text-[#666666]">{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive" data-testid="register-error-alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Google Sign Up Button */}
        <Button
          type="button"
          variant="outline"
          className="w-full bg-white border-[#DDDDDD] text-[#333333] hover:bg-[#F8F8F8]"
          onClick={handleGoogleSignUp}
          disabled={isGooglePending || isPending}
          data-testid="google-signup-btn"
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
          {isGooglePending ? t("signingUpWithGoogle") : t("signUpWithGoogle")}
        </Button>

        {/* Separator */}
        <div className="relative" data-testid="register-separator">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full border-[#DDDDDD]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-[#999999]">{t("or")}</span>
          </div>
        </div>

        <Form {...registerForm}>
          <form
            onSubmit={registerForm.handleSubmit(onRegister)}
            className="space-y-4"
          >
            <FormField
              control={registerForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#333333]">{t("name")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("namePlaceholder")}
                      data-testid="register-name-input"
                      className="border-[#DDDDDD] focus:border-[#EF6F4B] focus:ring-[#EF6F4B]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={registerForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#333333]">{t("email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      data-testid="register-email-input"
                      className="border-[#DDDDDD] focus:border-[#EF6F4B] focus:ring-[#EF6F4B]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={registerForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#333333]">{t("password")}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={t("passwordPlaceholder")}
                      data-testid="register-password-input"
                      className="border-[#DDDDDD] focus:border-[#EF6F4B] focus:ring-[#EF6F4B]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={registerForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#333333]">{t("confirmPassword")}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={t("confirmPasswordPlaceholder")}
                      data-testid="register-confirm-password-input"
                      className="border-[#DDDDDD] focus:border-[#EF6F4B] focus:ring-[#EF6F4B]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-[#3C4B5F] text-white hover:bg-[#2d3847]"
              disabled={isPending}
              data-testid="register-submit-btn"
            >
              {isPending ? t("creatingAccount") : t("createAccount")}
            </Button>
          </form>
        </Form>

        <p className="text-sm text-[#666666] text-center">
          {t.rich("legalAgreement", {
            terms: (chunks) => (
              <a
                key="terms"
                href={`${process.env.NEXT_PUBLIC_MAIN_URL || ""}/terms`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#333333]"
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
                className="underline hover:text-[#333333]"
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
