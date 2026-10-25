"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@zdocs/client-component";
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
import { Input } from "@zdocs/client-component";
import { Alert, AlertDescription } from "@zdocs/client-component";
import { zFetch } from "../../lib/utils";

type RequestResetData = {
  email: string;
};

type ConfirmResetData = {
  code: string;
  newPassword: string;
  confirmPassword: string;
};

export function ForgotPasswordForm({
  onBackToLogin,
}: {
  onBackToLogin?: () => void;
}) {
  const t = useTranslations("loginForm");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState<string>("");

  const requestResetSchema = useMemo(
    () =>
      z.object({
        email: z.string().email({ message: t("resetPasswordEmailInvalid") }),
      }),
    [t]
  );

  const confirmResetSchema = useMemo(
    () =>
      z
        .object({
          code: z.string().min(6, { message: t("resetCodeInvalid") }),
          newPassword: z.string().min(8, { message: t("passwordMinLength") }),
          confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t("passwordsDoNotMatch"),
          path: ["confirmPassword"],
        }),
    [t]
  );

  const requestForm = useForm<RequestResetData>({
    resolver: zodResolver(requestResetSchema as any),
    defaultValues: {
      email: "",
    },
  });

  const confirmForm = useForm<ConfirmResetData>({
    resolver: zodResolver(confirmResetSchema as any),
    defaultValues: {
      code: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onRequestReset(values: RequestResetData) {
    setError(null);
    setSuccess(null);
    setIsPending(true);

    try {
      const data = await zFetch("/api/auth/forgot-password", {
        method: "POST",
        body: {
          email: values.email,
        },
      });

      setEmail(data.email || values.email.toLowerCase());
      setStep("confirm");
      setSuccess(t("resetCodeSent", { email: data.email || values.email }));
    } catch (err: any) {
      const errorMessage =
        err.message || t("passwordResetFailed");
      setError(errorMessage);
    } finally {
      setIsPending(false);
    }
  }

  async function onConfirmReset(values: ConfirmResetData) {
    setError(null);
    setSuccess(null);
    setIsPending(true);

    try {
      await zFetch("/api/auth/reset-password", {
        method: "POST",
        body: {
          email,
          code: values.code,
          newPassword: values.newPassword,
          confirmPassword: values.confirmPassword,
        },
      });

      setSuccess(t("passwordResetSuccess"));
      // Reset forms
      requestForm.reset({ email: "" });
      confirmForm.reset({
        code: "",
        newPassword: "",
        confirmPassword: "",
      });
      // After a short delay, go back to login
      setTimeout(() => {
        onBackToLogin?.();
      }, 2000);
    } catch (err: any) {
      const errorMessage = err.message || t("passwordResetFailed");
      setError(errorMessage);
    } finally {
      setIsPending(false);
    }
  }

  if (step === "confirm") {
    return (
      <Card className="w-full max-w-md mx-auto bg-white border border-[#DDDDDD]" data-testid="reset-password-form-card">
        <CardHeader>
          <CardTitle className="text-2xl text-[#333333]">{t("forgotPasswordTitle")}</CardTitle>
          <CardDescription className="text-[#666666]">{t("enterResetCode")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" data-testid="reset-error-alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert variant="default" data-testid="reset-success-alert">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-[#666666]">
            {t("resetCodeSent", { email })}
          </p>

          <Form {...confirmForm}>
            <form
              onSubmit={confirmForm.handleSubmit(onConfirmReset)}
              className="space-y-4"
            >
              <FormField
                control={confirmForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#333333]">{t("resetCode")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("resetCodePlaceholder")}
                        maxLength={6}
                        data-testid="reset-code-input"
                        className="border-[#DDDDDD] focus:border-[#EF6F4B] focus:ring-[#EF6F4B]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={confirmForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#333333]">{t("newPassword")}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t("passwordPlaceholder")}
                        data-testid="reset-new-password-input"
                        className="border-[#DDDDDD] focus:border-[#EF6F4B] focus:ring-[#EF6F4B]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={confirmForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#333333]">{t("confirmNewPassword")}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t("passwordPlaceholder")}
                        data-testid="reset-confirm-password-input"
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
                data-testid="reset-password-submit-btn"
              >
                {isPending ? t("resettingPassword") : t("resetPassword")}
              </Button>
            </form>
          </Form>

          <Button
            variant="ghost"
            className="w-full text-[#666666] hover:text-[#333333] hover:bg-[#F8F8F8]"
            onClick={() => {
              setStep("request");
              setError(null);
              setSuccess(null);
            }}
            data-testid="back-to-request-btn"
          >
            {t("backToRequestReset")}
          </Button>

          {onBackToLogin && (
            <Button
              variant="ghost"
              className="w-full text-[#666666] hover:text-[#333333] hover:bg-[#F8F8F8]"
              onClick={onBackToLogin}
              data-testid="back-to-login-btn"
            >
              {t("backToLogin")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-white border border-[#DDDDDD]" data-testid="forgot-password-form-card">
      <CardHeader>
        <CardTitle className="text-2xl text-[#333333]">{t("forgotPasswordTitle")}</CardTitle>
        <CardDescription className="text-[#666666]">{t("forgotPasswordDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive" data-testid="forgot-password-error-alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="default" data-testid="forgot-password-success-alert">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Form {...requestForm}>
          <form
            onSubmit={requestForm.handleSubmit(onRequestReset)}
            className="space-y-4"
          >
            <FormField
              control={requestForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#333333]">{t("resetPasswordEmail")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t("resetPasswordEmailPlaceholder")}
                      data-testid="forgot-password-email-input"
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
              data-testid="send-reset-code-btn"
            >
              {isPending ? t("sendingResetCode") : t("sendResetCode")}
            </Button>
          </form>
        </Form>

        {onBackToLogin && (
          <Button
            variant="ghost"
            className="w-full text-[#666666] hover:text-[#333333] hover:bg-[#F8F8F8]"
            onClick={onBackToLogin}
            data-testid="back-to-login-from-request-btn"
          >
            {t("backToLogin")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
