"use client";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const encodedName = encodeURIComponent(name);
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${encodedName}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.substring(encodedName.length + 1));
}

function getCookieDomain(hostname: string): string | null {
  if (hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return null;
  }

  const parts = hostname.split(".").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  return `.${parts.slice(-2).join(".")}`;
}

function setCookie(name: string, value: string, maxAgeMs: number) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const cookieParts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    "SameSite=Lax",
  ];

  const domain = getCookieDomain(window.location.hostname);
  if (domain) {
    cookieParts.push(`Domain=${domain}`);
  }

  if (window.location.protocol === "https:") {
    cookieParts.push("Secure");
  }

  document.cookie = cookieParts.join("; ");
}

export function getOrCreateSharedSessionId({
  sessionKey,
  timestampKey,
  sessionTimeoutMs,
  createSessionId,
}: {
  sessionKey: string;
  timestampKey: string;
  sessionTimeoutMs: number;
  createSessionId: () => string;
}) {
  if (typeof window === "undefined") {
    return createSessionId();
  }

  const now = Date.now();
  const storedSessionId =
    getCookie(sessionKey) ?? localStorage.getItem(sessionKey);
  const storedTimestamp =
    getCookie(timestampKey) ?? localStorage.getItem(timestampKey);

  if (storedSessionId && storedTimestamp) {
    const lastActivity = Number.parseInt(storedTimestamp, 10);
    if (!Number.isNaN(lastActivity) && now - lastActivity < sessionTimeoutMs) {
      setCookie(sessionKey, storedSessionId, sessionTimeoutMs);
      setCookie(timestampKey, now.toString(), sessionTimeoutMs);
      localStorage.setItem(sessionKey, storedSessionId);
      localStorage.setItem(timestampKey, now.toString());
      return storedSessionId;
    }
  }

  const newSessionId = createSessionId();
  setCookie(sessionKey, newSessionId, sessionTimeoutMs);
  setCookie(timestampKey, now.toString(), sessionTimeoutMs);
  localStorage.setItem(sessionKey, newSessionId);
  localStorage.setItem(timestampKey, now.toString());
  return newSessionId;
}
