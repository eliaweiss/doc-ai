// Storage keys for session tracking (same as useLogUserJourneyEvent hook)
const SESSION_KEY = "user_session_id";
const SESSION_TIMESTAMP_KEY = "user_session_timestamp";
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour

/**
 * Get or create a session ID that persists across tabs but expires after 1 hour of inactivity.
 * Same logic as the useLogUserJourneyEvent hook in @zdocs/client.
 */
function getOrCreateSessionId(): string {
    const now = Date.now();
    const storedSessionId = localStorage.getItem(SESSION_KEY);
    const storedTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);

    if (storedSessionId && storedTimestamp) {
        const lastActivity = parseInt(storedTimestamp);
        if (now - lastActivity < SESSION_TIMEOUT) {
            localStorage.setItem(SESSION_TIMESTAMP_KEY, now.toString());
            return storedSessionId;
        }
    }

    // Create new session (either doesn't exist or expired)
    const newSessionId = `anon_${now}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(SESSION_KEY, newSessionId);
    localStorage.setItem(SESSION_TIMESTAMP_KEY, now.toString());

    return newSessionId;
}

export const logEvent = async ({
    eventType,
    eventData,
    backendUrl,
}: { eventType: string; eventData: any; backendUrl: string }) => {
    try {
        if (typeof window === "undefined") {
            console.warn("logEvent called on server side, skipping");
            return null;
        }

        const sessionId = getOrCreateSessionId();
        const url = backendUrl + "/api/user-journey-events";

        // Call the API to log the event
        return await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                eventType,
                eventData,
                sessionId,
            }),
        });
    } catch (error) {
        console.error("Error logging user journey event:", error);
        return null;
    }
};