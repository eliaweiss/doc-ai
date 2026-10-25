"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { LoadingDots } from "@zdocs/client-component";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { zFetch } from "../../lib/utils";

interface ProfileContentProps {
  showTitle?: boolean;
}

export function ProfileContent({ showTitle = true }: ProfileContentProps) {
  const { data: session, status, update: updateSession } = useSession();
  const t = useTranslations();
  const [name, setName] = useState<string>("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const fetchUserPreferences = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      const response = await fetch(`/api/users/${session.user.id}`, {
        method: "GET",
      });

      const data = await response.json();
      setName(data.name || "");
    } catch (error) {
      console.error(t("profile.error_fetching_user_preferences"), error);
      toast.error(t("profile.failed_to_load_user_preferences"));
    } finally {
      setIsInitialLoading(false);
    }
  }, [session?.user?.id, t]);

  // Fetch user's current preferences
  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      fetchUserPreferences();
    }
  }, [status, session?.user?.id, fetchUserPreferences]);

  const handleNameSave = async () => {
    if (!session?.user?.id) return;

    setIsSavingName(true);
    try {
      await zFetch(`/api/users/${session.user.id}`, {
        method: "PATCH",
        body: { name: name.trim() || null },
      });
      
      // Update session to reflect the new name
      await updateSession();
      
      toast.success(t("profile.name_saved"));
    } catch (error) {
      console.error(t("profile.error_updating_name"), error);
      toast.error(t("profile.failed_to_update_name"));
      // Revert to original name on error
      setName(session?.user?.name || "");
    } finally {
      setIsSavingName(false);
    }
  };

  // Show loading state while checking authentication or loading data
  if (status === "loading" || isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingDots message={t("profile.loading")} />
      </div>
    );
  }

  return (
    <div className={showTitle ? "container p-10" : ""}>
      {showTitle && (
        <h1 className="text-3xl font-bold mb-6">{t("profile.your_profile")}</h1>
      )}

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.account_information")}</CardTitle>
            <CardDescription>
              {t("profile.your_personal_account_details")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="profile-name" className="text-sm font-medium text-muted-foreground">
                {t("profile.name")}
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  disabled={isSavingName}
                  placeholder={t("profile.not_provided")}
                  className="text-lg"
                  data-testid="profile-name-input"
                />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("profile.email")}
              </h3>
              <p className="text-lg">{session?.user?.email}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("profile.user_id")}
              </h3>
              <p className="text-sm text-muted-foreground break-all">
                {session?.user?.id}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 
          Currently disabled - emails are essential for task notifications

        <Card>
          <CardHeader>
            <CardTitle>{t("profile.email_preferences")}</CardTitle>
            <CardDescription>
              {t("profile.manage_email_notification_settings")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="email-notifications"
                checked={optInEmail}
                onCheckedChange={handleEmailOptInChange}
                disabled={isLoading}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Label
                  htmlFor="email-notifications"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {t("profile.receive_email_notifications")}
                </Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 ml-6">
              {t("profile.email_notifications_description")}
            </p>
          </CardContent> 
        </Card>
        */}
      </div>
    </div>
  );
}
