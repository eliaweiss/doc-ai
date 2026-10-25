/**
 * Schedule calculation utilities for tasks
 */

import type { TaskFrequency } from "@zdocs/types";
import { TZDate } from "@date-fns/tz";

/**
 * Calculate next_run_at based on schedule configuration
 * Uses organization's timezone for calculations
 *
 * @param frequency - Task frequency (DAILY, WEEKLY, MONTHLY)
 * @param dayOfWeek - Day of week (0-6, Sunday=0) for WEEKLY, null otherwise
 * @param dayOfMonth - Day of month (1-31) for MONTHLY, null otherwise
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @param orgTimezone - Organization timezone (e.g., "America/New_York", "UTC")
 * @returns Next run date/time
 */
export function calculateNextRunAt(
  frequency: TaskFrequency,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  hour: number,
  minute: number,
  orgTimezone: string = "UTC"
): Date {
  const now = new Date();
  const nowInTz = new TZDate(now, orgTimezone);

  switch (frequency) {
    case "DAILY": {
      // Today at task.hour:task.minute in org timezone, or tomorrow if past
      const nextDay = new TZDate(now, orgTimezone);
      nextDay.setHours(hour, minute, 0, 0);
      
      if (nextDay <= nowInTz) {
        // Time has passed today, move to tomorrow
        nextDay.setDate(nextDay.getDate() + 1);
      }
      
      return new Date(nextDay.getTime());
    }

    case "WEEKLY": {
      if (dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6) {
        throw new Error("dayOfWeek is required for WEEKLY frequency");
      }

      // Next occurrence of day_of_week at task.hour:task.minute in org timezone
      const nextWeek = new TZDate(now, orgTimezone);
      const targetDay = dayOfWeek;
      const currentDay = nextWeek.getDay();
      let daysUntilTarget = (targetDay - currentDay + 7) % 7;

      // Set the time first
      nextWeek.setHours(hour, minute, 0, 0);

      if (daysUntilTarget === 0) {
        // Same day - check if time has passed
        if (nextWeek <= nowInTz) {
          daysUntilTarget = 7; // Next week
          nextWeek.setDate(nextWeek.getDate() + daysUntilTarget);
        }
      } else {
        // Different day - add the days
        nextWeek.setDate(nextWeek.getDate() + daysUntilTarget);
      }

      return new Date(nextWeek.getTime());
    }

    case "MONTHLY": {
      if (dayOfMonth === null || dayOfMonth < 1 || dayOfMonth > 31) {
        throw new Error("dayOfMonth is required for MONTHLY frequency (1-31)");
      }

      // Next occurrence on day_of_month at task.hour:task.minute in org timezone
      const nextMonth = new TZDate(now, orgTimezone);
      nextMonth.setDate(dayOfMonth);
      nextMonth.setHours(hour, minute, 0, 0);

      if (nextMonth <= nowInTz) {
        // Move to next month
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        // Handle months with fewer days (e.g., Feb 31 -> Feb 28/29)
        const targetDay = dayOfMonth;
        const lastDayOfMonth = new Date(
          nextMonth.getFullYear(),
          nextMonth.getMonth() + 1,
          0
        ).getDate();
        nextMonth.setDate(Math.min(targetDay, lastDayOfMonth));
        nextMonth.setHours(hour, minute, 0, 0);
      }

      return new Date(nextMonth.getTime());
    }

    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

/**
 * Format schedule as human-readable string
 */
export function formatSchedule(
  frequency: TaskFrequency,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  hour: number,
  minute: number
): string {
  const timeStr = formatTime(hour, minute);

  switch (frequency) {
    case "DAILY":
      return `Daily at ${timeStr}`;

    case "WEEKLY": {
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const dayName = dayOfWeek !== null ? dayNames[dayOfWeek] : "Unknown";
      return `Weekly on ${dayName} at ${timeStr}`;
    }

    case "MONTHLY": {
      const dayStr =
        dayOfMonth === null
          ? "Unknown"
          : dayOfMonth === 31
            ? "the last day"
            : `${getOrdinal(dayOfMonth)}`;
      return `Monthly on the ${dayStr} at ${timeStr}`;
    }

    default:
      return "Unknown schedule";
  }
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinute = minute.toString().padStart(2, "0");
  return `${displayHour}:${displayMinute} ${period}`;
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Calculate the next N execution times
 */
export function calculateNextExecutions(
  frequency: TaskFrequency,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  hour: number,
  minute: number,
  count: number,
  orgTimezone: string = "UTC"
): Date[] {
  const executions: Date[] = [];
  
  // Calculate first execution
  const firstRun = calculateNextRunAt(
    frequency,
    dayOfWeek,
    dayOfMonth,
    hour,
    minute,
    orgTimezone
  );
  executions.push(new Date(firstRun));

  // Calculate subsequent executions
  let currentTzDate = new TZDate(firstRun, orgTimezone);
  for (let i = 1; i < count; i++) {
    switch (frequency) {
      case "DAILY":
        currentTzDate.setDate(currentTzDate.getDate() + 1);
        currentTzDate.setHours(hour, minute, 0, 0);
        break;
      case "WEEKLY":
        currentTzDate.setDate(currentTzDate.getDate() + 7);
        currentTzDate.setHours(hour, minute, 0, 0);
        break;
      case "MONTHLY":
        currentTzDate.setMonth(currentTzDate.getMonth() + 1);
        // Handle months with fewer days
        const targetDay = dayOfMonth || 1;
        const lastDayOfMonth = new Date(
          currentTzDate.getFullYear(),
          currentTzDate.getMonth() + 1,
          0
        ).getDate();
        currentTzDate.setDate(Math.min(targetDay, lastDayOfMonth));
        currentTzDate.setHours(hour, minute, 0, 0);
        break;
    }
    executions.push(new Date(currentTzDate.getTime()));
  }

  return executions;
}
