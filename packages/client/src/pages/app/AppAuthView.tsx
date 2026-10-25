"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LoginForm } from "../login/login-form";
import { RegisterForm } from "../register/register-form";
import { DocVisionLogo, OneFlowLogo } from "@zdocs/client-component";
import { cn } from "../../lib/utils";
import { APP_DISPLAY_NAME } from "@zdocs/util";
import { IS_DOC_VISION } from "@zdocs/util";
import { useLogUserJourneyEvent } from "../../utilities/api/logUserJourneyEventApi";

type AuthView = "login" | "register";

export function AppAuthView() {
  const t = useTranslations("appPage");
  const { logEvent } = useLogUserJourneyEvent();
  const [authView, setAuthView] = useState<AuthView>("login");
  const [prefillLoginEmail, setPrefillLoginEmail] = useState<string>("");

  const handleAuthViewChange = (view: AuthView) => {
    setAuthView(view);
    logEvent({
      eventType: "browse_auth_tab_selected",
      eventData: {
        tab: view,
      },
    });
  };

  return (
    <div
      className="h-screen bg-background flex overflow-hidden"
      data-testid="app-page-auth"
    >
      {/* Left Pane - Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center px-12 relative overflow-hidden bg-background"
        data-testid="app-auth-branding-pane"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--ring)/0.3),transparent_50%)]" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-ring/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-ring/10 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-md text-center space-y-6">
          <div className="flex justify-center mb-6" data-testid="app-auth-header">
            {IS_DOC_VISION ? <DocVisionLogo size={64} backgroundColor={"#F8F8F8"} /> : <OneFlowLogo size={64} backgroundColor={"#F8F8F8"} />}
          </div>
          <h1
            className="text-5xl font-bold text-foreground tracking-tight"
            data-testid="app-page-title"
          >
            {t("welcomeTitle", { appName: APP_DISPLAY_NAME })}
          </h1>
          <p
            className="text-xl text-muted-foreground leading-relaxed"
            data-testid="app-page-subtitle"
          >
            {t("subtitle")}
          </p>

          {/* Feature highlights */}
          <div className="mt-12 space-y-4 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-ring/10 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-ring"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground">{t("featureSmartDocTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("featureSmartDocDesc")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-ring/10 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-ring"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground">{t("featureReconciliationTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("featureReconciliationDesc")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-ring/10 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-ring"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground">{t("featureInsightsTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("featureInsightsDesc")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Auth Forms */}
      <div
        className="w-full lg:w-1/2 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-12 overflow-y-auto bg-card"
        data-testid="app-auth-forms-pane"
      >
        <div className="w-full max-w-md space-y-6 py-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-6" data-testid="app-auth-mobile-header">
            <div className="flex justify-center mb-4">
              <OneFlowLogo size={48} />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{t("welcomeTitle", { appName: APP_DISPLAY_NAME })}</h2>
            <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
          </div>

          {/* Auth Toggle Tabs */}
          <div
            className="w-full flex rounded-lg bg-background p-1.5 border border-border"
            data-testid="app-page-auth-tabs"
          >
            <button
              type="button"
              onClick={() => handleAuthViewChange("login")}
              className={cn(
                "flex-1 py-3 px-4 text-sm font-medium rounded-md transition-all duration-200",
                authView === "login"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="app-page-login-tab"
            >
              {t("loginTab")}
            </button>
            <button
              type="button"
              onClick={() => handleAuthViewChange("register")}
              className={cn(
                "flex-1 py-3 px-4 text-sm font-medium rounded-md transition-all duration-200",
                authView === "register"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="app-page-register-tab"
            >
              {t("registerTab")}
            </button>
          </div>

          {/* Auth Form */}
          <div className="w-full" data-testid="app-page-auth-form">
            {authView === "login" ? (
              <LoginForm
                prefillEmail={prefillLoginEmail}
                onPrefillConsumed={() => setPrefillLoginEmail("")}
              />
            ) : (
              <RegisterForm
                onRegistered={(email) => {
                  setPrefillLoginEmail(email);
                  handleAuthViewChange("login");
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
