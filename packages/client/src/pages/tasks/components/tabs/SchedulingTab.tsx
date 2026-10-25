"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Input } from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import { Textarea } from "@zdocs/client-component";
import { Checkbox } from "@zdocs/client-component";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zdocs/client-component";
import { useTasksPage } from "../../context/TasksPageProvider";
import useOrgStore from "../../../../context-providers/orgStore";
import { toast } from "sonner";
import { zFetch } from "../../../../lib/utils";
import type { TaskFrequency } from "@zdocs/types";
import {
  calculateNextExecutions,
  formatDateTimeWithTimezone,
} from "@zdocs/util";

interface SchedulingTabProps {}

export function SchedulingTab({}: SchedulingTabProps) {
  const t = useTranslations("tasks");
  const { selectedTask, registerSaveHandler, unregisterSaveHandler, setDirty } =
    useTasksPage();
  const { org } = useOrgStore();
  const [availableEmails, setAvailableEmails] = useState<string[]>([]);

  // Form state
  const [frequency, setFrequency] = useState<TaskFrequency>("DAILY");
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(null);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [notificationEmails, setNotificationEmails] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [isReminder, setIsReminder] = useState(false);

  // Initialize form state from selectedTask
  useEffect(() => {
    if (selectedTask) {
      setFrequency(selectedTask.frequency);
      setDayOfWeek(selectedTask.dayOfWeek);
      setDayOfMonth(selectedTask.dayOfMonth);
      setHour(selectedTask.hour);
      setMinute(selectedTask.minute);
      setNotificationEmails(selectedTask.notificationEmails || []);
      setInstructions(selectedTask.instructions);
      setIsReminder(selectedTask.isReminder);
    }
  }, [selectedTask]);

  // Track dirty state
  useEffect(() => {
    if (!selectedTask) return;

    const isDirty =
      frequency !== selectedTask.frequency ||
      dayOfWeek !== selectedTask.dayOfWeek ||
      dayOfMonth !== selectedTask.dayOfMonth ||
      hour !== selectedTask.hour ||
      minute !== selectedTask.minute ||
      instructions !== selectedTask.instructions ||
      isReminder !== selectedTask.isReminder ||
      JSON.stringify(notificationEmails.sort()) !==
        JSON.stringify((selectedTask.notificationEmails || []).sort());

    setDirty(isDirty);
  }, [
    selectedTask,
    frequency,
    dayOfWeek,
    dayOfMonth,
    hour,
    minute,
    instructions,
    isReminder,
    notificationEmails,
    setDirty,
  ]);

  // Register save handler with provider
  useEffect(() => {
    registerSaveHandler("scheduling", {
      getData: () => ({
        frequency,
        dayOfWeek,
        dayOfMonth,
        hour,
        minute,
        notificationEmails,
        instructions,
        isReminder,
      }),
      validate: () => {
        if (
          frequency === "WEEKLY" &&
          (dayOfWeek === null || dayOfWeek === undefined)
        ) {
          toast.error(t("dayOfWeekRequired"));
          return false;
        }
        if (
          frequency === "MONTHLY" &&
          (dayOfMonth === null || dayOfMonth === undefined)
        ) {
          toast.error(t("dayOfMonthRequired"));
          return false;
        }
        return true;
      },
    });

    return () => {
      unregisterSaveHandler("scheduling");
    };
  }, [
    frequency,
    dayOfWeek,
    dayOfMonth,
    hour,
    minute,
    notificationEmails,
    instructions,
    isReminder,
    registerSaveHandler,
    unregisterSaveHandler,
    t,
  ]);

  // Fetch available notification emails (owner + shared)
  useEffect(() => {
    if (!org?.id) {
      setAvailableEmails([]);
      return;
    }

    const fetchEmails = async () => {
      try {
        const data = await zFetch(`/api/org/${org.id}/notification-emails`, {
          method: "POST",
        });
        setAvailableEmails(data.emails || []);
      } catch (error) {
        console.error("Failed to fetch notification emails:", error);
        // Fallback to shared emails only
        setAvailableEmails(org.sharedWithEmails || []);
      }
    };

    fetchEmails();
  }, [org?.id, org?.sharedWithEmails]);

  const handleToggleNotificationEmail = (email: string) => {
    setNotificationEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const dayNames = [
    t("sunday"),
    t("monday"),
    t("tuesday"),
    t("wednesday"),
    t("thursday"),
    t("friday"),
    t("saturday"),
  ];

  return (
    <div className="max-w-2xl space-y-6" data-testid="scheduling-tab">
      <div className="space-y-2">
        <Label htmlFor="instructions">{t("instructions")}</Label>
        <Textarea
          id="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={t("instructionsPlaceholder")}
          rows={4}
          data-testid="instructions-input"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is-reminder"
          checked={isReminder}
          onCheckedChange={(checked) => setIsReminder(checked === true)}
          data-testid="is-reminder-checkbox"
        />
        <Label htmlFor="is-reminder" className="cursor-pointer">
          {t("sendEmailReminder")}
        </Label>
      </div>

      {isReminder && (
        <div className="space-y-2">
          <Label>{t("notificationEmails")}</Label>
          {availableEmails.length > 0 ? (
            <div className="space-y-2 border border-border rounded-md p-4">
              {availableEmails.map((email) => (
                <div
                  key={email}
                  className="flex items-center space-x-2"
                  data-testid={`notification-email-${email}`}
                >
                  <Checkbox
                    id={`email-${email}`}
                    checked={notificationEmails.includes(email)}
                    onCheckedChange={() => handleToggleNotificationEmail(email)}
                  />
                  <Label
                    htmlFor={`email-${email}`}
                    className="cursor-pointer text-sm"
                  >
                    {email}
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-md p-4">
              <p
                className="text-sm text-muted-foreground"
                data-testid="no-emails-message"
              >
                {t("noEmailsAvailable")}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="frequency">{t("frequency")}</Label>
        <Select
          value={frequency}
          onValueChange={(value) => {
            setFrequency(value as TaskFrequency);
            if (value !== "WEEKLY") setDayOfWeek(null);
            if (value !== "MONTHLY") setDayOfMonth(null);
          }}
        >
          <SelectTrigger id="frequency" data-testid="frequency-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DAILY">{t("daily")}</SelectItem>
            <SelectItem value="WEEKLY">{t("weekly")}</SelectItem>
            <SelectItem value="MONTHLY">{t("monthly")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {frequency === "WEEKLY" && (
        <div className="space-y-2">
          <Label htmlFor="day-of-week">{t("dayOfWeek")}</Label>
          <Select
            value={dayOfWeek?.toString() || ""}
            onValueChange={(value) => setDayOfWeek(parseInt(value, 10))}
          >
            <SelectTrigger id="day-of-week" data-testid="day-of-week-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dayNames.map((name, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {frequency === "MONTHLY" && (
        <div className="space-y-2">
          <Label htmlFor="day-of-month">{t("dayOfMonth")}</Label>
          <Input
            id="day-of-month"
            type="number"
            min="1"
            max="31"
            value={dayOfMonth || ""}
            onChange={(e) =>
              setDayOfMonth(
                e.target.value ? parseInt(e.target.value, 10) : null
              )
            }
            data-testid="day-of-month-input"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hour">{t("hour")}</Label>
          <Input
            id="hour"
            type="number"
            min="0"
            max="23"
            value={hour}
            onChange={(e) => setHour(parseInt(e.target.value, 10) || 0)}
            data-testid="hour-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minute">{t("minute")}</Label>
          <Input
            id="minute"
            type="number"
            min="0"
            max="59"
            value={minute}
            onChange={(e) => setMinute(parseInt(e.target.value, 10) || 0)}
            data-testid="minute-input"
          />
        </div>
      </div>

      {/* Next Executions Preview */}
      {selectedTask &&
        org &&
        (() => {
          // Validate schedule before calculating
          const isValidSchedule =
            frequency === "DAILY" ||
            (frequency === "WEEKLY" &&
              dayOfWeek !== null &&
              dayOfWeek !== undefined) ||
            (frequency === "MONTHLY" &&
              dayOfMonth !== null &&
              dayOfMonth !== undefined);

          if (!isValidSchedule) {
            return (
              <div className="space-y-2">
                <Label>{t("nextExecutions")}</Label>
                <div className="border border-border rounded-md p-4">
                  <div
                    className="text-sm text-muted-foreground"
                    data-testid="executions-incomplete"
                  >
                    {t("completeScheduleToPreview")}
                  </div>
                </div>
              </div>
            );
          }

          try {
            // Use org timezone - it should always be set (defaults to UTC in DB)
            const orgTimezone = org.timezone || "UTC";
            const nextExecutions = calculateNextExecutions(
              frequency,
              dayOfWeek,
              dayOfMonth,
              hour,
              minute,
              3,
              orgTimezone
            );
            return (
              <div className="space-y-2">
                <Label>{t("nextExecutions")}</Label>
                <div className="border border-border rounded-md p-4 space-y-2">
                  {nextExecutions.map((executionDate, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm"
                      data-testid={`next-execution-${index}`}
                    >
                      <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">
                        {index === 0
                          ? t("nextRun")
                          : `${t("execution")} ${index + 1}:`}
                      </span>
                      <span className="text-foreground font-medium">
                        {formatDateTimeWithTimezone(executionDate, orgTimezone)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          } catch (error) {
            return (
              <div className="space-y-2">
                <Label>{t("nextExecutions")}</Label>
                <div className="border border-border rounded-md p-4">
                  <div
                    className="text-sm text-muted-foreground"
                    data-testid="executions-error"
                  >
                    {t("invalidSchedule")}
                  </div>
                </div>
              </div>
            );
          }
        })()}
    </div>
  );
}
