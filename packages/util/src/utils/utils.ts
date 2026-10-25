import { customAlphabet } from "nanoid";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { TZDate } from "@date-fns/tz";
import { formatDistanceToNow as formatDistanceToNowNative } from "date-fns";
import { UIMessage, UIMessagePart } from "ai";
import { SearchableEntityOption } from "@zdocs/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calcPercentage(total: number, current: number) {
  return total ? Math.round((current / total) * 100) : 0;
}

///////////////////////////
export function debounce(fn: (...args: any[]) => void, delay: number) {
  let timer: NodeJS.Timeout;
  return function (this: unknown, ...args: any[]) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789");

//////
export const getTimeInUtc = (date: Date) => {
  // console.log(">> date", date);
  const utcDate = new TZDate(date, "UTC");
  // console.log(">> utcDate", utcDate);
  return utcDate;
};

//////////////
export const formatDistanceToNow = (
  date: Date,
  options?: { addSuffix?: boolean; includeSeconds?: boolean }
) => {
  return formatDistanceToNowNative(getTimeInUtc(date), options);
};
//////////////
export const RTL_CHARS_REGEX = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

export const getDirectionFromText = (
  message: UIMessage | string
): "ltr" | "rtl" => {
  let text = "";
  if (typeof message === "string") {
    text = message;
  } else {
    text = getAiMsgText(message);
  }
  if (!text) return "ltr";
  return RTL_CHARS_REGEX.test(text) ? "rtl" : "ltr";
};

// Function to detect if user agent is from a mobile device
export function isMobileDevice(userAgent: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    userAgent
  );
}

export function isBotUserAgent(userAgent: string): boolean {
  return /AdsBot-Google|Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Slurp|facebookexternalhit|Twitterbot|LinkedInBot|Applebot|SemrushBot|AhrefsBot|MJ12bot|DotBot|PetalBot|UptimeRobot|HeadlessChrome/i.test(
    userAgent
  );
}

export function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function isMobileWidth() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const getBaseUrl = () => {
  // make sure to remove the trailing slash
  return process.env.NEXT_PUBLIC_URL?.replace(/\/$/, "");
};

export function toCamelCase(str: string) {
  return str
    .replace(/[^a-zA-Z0-9 ]/g, "") // remove non-alphanumerics
    .replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function (match, index) {
      if (+match === 0 || match === "-") return ""; // skip numbers and hyphens
      return index === 0 ? match.toLowerCase() : match.toUpperCase();
    });
}

export const getAiPartToolName = (part: UIMessagePart<any, any>) => {
  return part?.type?.split("-")[1];
};

export const isAiPartToolCall = (part: UIMessagePart<any, any>) => {
  return part?.type?.startsWith("tool-");
};

export const getAiMsgToolInvocationPart = (msg: UIMessage) => {
  return msg?.parts?.filter((part: UIMessagePart<any, any>) =>
    isAiPartToolCall(part)
  );
};

export const getAiMsgText = (message: UIMessage) => {
  let text = "";
  if (message && message.parts) {
    for (const part of message.parts) {
      if (part.type === "text" && part.text) {
        text = part.text;
        break;
      }
    }
  }
  return text;
};

export function stringToDataTestId(str: string) {
  return str.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Get currency symbol from currency code
 * @param currency - ISO 4217 currency code (e.g., "USD", "BRL", "EUR")
 * @returns Currency symbol (e.g., "$", "R$", "€") or null if invalid
 */
export function getCurrencySymbol(currency: string): string | null {
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency,
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Format a number as currency
 * @param amount - The amount to format (number or string)
 * @param currency - Optional ISO 4217 currency code (e.g., "USD", "BRL")
 * @returns Formatted currency string or "-" if invalid
 */
export function formatCurrency(
  amount: number | string | null,
  currency?: string | null
): string {
  if (amount === null || amount === undefined) return "-";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return String(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: currency ? "currency" : "decimal",
      currency: currency || undefined,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency ? currency : ""}${num.toFixed(2)}`;
  }
}

/**
 * Format a date for display
 * @param date - The date to format (Date object or string)
 * @returns Formatted date string or "-" if invalid
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return "-";

  // If it's already a date string in ISO format (yyyy-MM-dd), extract directly
  // to avoid timezone conversion issues with new Date()
  if (typeof date === "string") {
    const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
  }

  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format date and time with timezone
 * @param date - The date to format
 * @param timezone - Timezone string (e.g., "America/New_York", "UTC")
 * @returns Formatted string with date, time, and timezone
 */
export function formatDateTimeWithTimezone(
  date: Date,
  timezone: string = "UTC"
): string {
  try {
    // Use Intl.DateTimeFormat for reliable timezone formatting
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) =>
      parts.find((p) => p.type === type)?.value || "";

    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const hour = getPart("hour");
    const minute = getPart("minute");
    const dayPeriod = getPart("dayPeriod");
    const timeZoneName = getPart("timeZoneName");

    return `${year}-${month}-${day} ${hour}:${minute} ${dayPeriod} ${timeZoneName}`;
  } catch (error) {
    // Fallback to simple format if timezone is invalid
    const dateStr = formatDate(date);
    const timeStr = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr} ${timeStr} (${timezone})`;
  }
}

//////////////////////////////////////////////////////////////
// Helper function to recursively sort object keys for consistent ordering
export const sortObjectKeys = (obj: any): any => {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sortObjectKeys(item));
  }

  const sortedObj: any = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    sortedObj[key] = sortObjectKeys(obj[key]);
  }

  return sortedObj;
};

export const getHeaderEntityByDoctype = (
  docType: string,
  entities: SearchableEntityOption[]
) => {
  for (const entity of entities) {
    if (entity.entityType !== "HEADER") {
      continue;
    }
    if (entity.docType === docType) {
      return entity;
    }
  }
  return null;
};

export function getDateStr(date?: Date | string | null) {
  if (!date) return null;
  return typeof date === "string"
    ? date.split("T")[0]
    : date.toISOString().slice(0, 10);
}

export function getDayDrift(
  sourceDate: string | null | undefined,
  targetDate: string | null | undefined
) {
  if (!sourceDate || !targetDate) {
    return 0;
  }
  const d1 = new Date(sourceDate);
  const d2 = new Date(targetDate);
  const result = Math.abs(Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
  // console.log("getDayDrift", sourceDate, targetDate, result);
  return result;
}

export function getUiTxSdkUrl() {
  const domain = process.env.NEXT_PUBLIC_URL;
  return `${domain}/sdk/ui-tx/v1.js`;
}

/**
 * Determines if a color is light or dark
 * Returns true if the color is light (should use dark text), false if dark (should use light text)
 */
export function isLightColor(hex: string): boolean {
  // Remove # if present
  const cleanHex = hex.replace("#", "");

  // Convert hex to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Calculate relative luminance (perceived brightness)
  // Using the formula: 0.299*R + 0.587*G + 0.114*B
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // If luminance is greater than 0.5, it's a light color
  return luminance > 0.5;
}

/**
 * Gets the appropriate text color (black or white) based on background color brightness
 */
export function getTextColorForBackground(hex: string): string {
  return isLightColor(hex) ? "#000000" : "#ffffff";
}

