"use client";

import { useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { nanoid } from "nanoid";
import { fetchLocation } from "@zdocs/util";
import { useAppStore } from "../../context-providers/appStore";
import { zFetch } from "../../lib/utils";
import { getOrCreateSharedSessionId } from "./sessionCookie";

interface LogUserJourneyEventParams {
  eventType: string;
  eventData?: any;
}

const DOC_AI_ANALYTICS_DISABLED = true;

// Storage keys for session tracking
const SESSION_KEY = "user_session_id";
const SESSION_TIMESTAMP_KEY = "user_session_timestamp";

// Session expires after 1 hour of inactivity
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

// Debounce storage for preventing duplicate events
const LAST_EVENT_KEY = "last_user_journey_event";
const LAST_EVENT_TIMESTAMP_KEY = "last_user_journey_event_timestamp";
const DEBOUNCE_TIMEOUT = 2000; // 2 seconds in milliseconds


/**
 * React hook for logging user journey events (use inside SessionProvider)
 */
export const useLogUserJourneyEvent = () => {
  const { data: session } = useSession();
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const logEvent = useCallback(async ({
    eventType,
    eventData,
  }: LogUserJourneyEventParams) => {
    // doc-ai: no analytics. This also skips fetchLocation(), which calls ipapi.co.
    if (DOC_AI_ANALYTICS_DISABLED) return null;
    const { locale, mockStateId } = useAppStore.getState();
    if (mockStateId) {
      return null;
    }
    try {
      if (typeof window === "undefined") {
        console.warn("useLogUserJourneyEvent called on server side, skipping");
        return null;
      }

      if (shouldSkipEvent(eventType)) {
        return null;
      }

      const { userId, sessionId, isAdmin, email } = getUserIdentifiers(sessionRef.current);
      if (isAdmin) {
        console.log("Skipping admin event:", eventType);
        return null;
      }
      if (email?.includes("test")) {
        return null;
      }
      const location = await fetchLocation();

      return await zFetch("/api/user-journey-events", {
        method: "POST",
        body: {
          eventType,
          eventData,
          userId,
          sessionId,
          location,
          locale,
        },
      });
    } catch (error) {
      console.error("Error logging user journey event:", error);
      return null;
    }
  }, []);

  return { logEvent };
};



/**
 * Get or create a session ID that persists across tabs but expires after 1 hour of inactivity
 */
function getOrCreateSessionId(): string {
  return getOrCreateSharedSessionId({
    sessionKey: SESSION_KEY,
    timestampKey: SESSION_TIMESTAMP_KEY,
    sessionTimeoutMs: SESSION_TIMEOUT,
    createSessionId: () => nanoid(),
  });
}

/**
 * Get user identifiers based on authentication status
 */
function getUserIdentifiers(session: any): {
  userId: string | null;
  sessionId: string;
  isAdmin: boolean;
  email: string | null;
} {
  const sessionId = getOrCreateSessionId();
  // console.log("getUserIdentifiers session", session);

  if (session?.user) {
    // User is authenticated - use their actual user ID
    return {
      userId: session.user.id,
      sessionId,
      isAdmin: session.user.isAdmin,
      email: session.user.email,
    };
  } else {
    // User is anonymous
    return {
      userId: null,
      sessionId,
      isAdmin: false,
      email: null,
    };
  }
}

/**
 * Check if we should skip this event due to debouncing
 */
function shouldSkipEvent(eventType: string): boolean {
  const now = Date.now();
  const lastEventType = localStorage.getItem(LAST_EVENT_KEY);
  const lastEventTimestamp = localStorage.getItem(LAST_EVENT_TIMESTAMP_KEY);

  // If same event type and within debounce window, skip
  if (lastEventType === eventType && lastEventTimestamp) {
    const timeSinceLastEvent = now - parseInt(lastEventTimestamp);
    if (timeSinceLastEvent < DEBOUNCE_TIMEOUT) {
      console.log(
        `🔄 Skipping duplicate event "${eventType}" (sent ${timeSinceLastEvent}ms ago)`
      );
      return true;
    }
  }

  // Update last event info
  localStorage.setItem(LAST_EVENT_KEY, eventType);
  localStorage.setItem(LAST_EVENT_TIMESTAMP_KEY, now.toString());

  return false;
}