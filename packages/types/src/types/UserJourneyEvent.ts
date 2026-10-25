// ═══════════════════════════════════════════════════════════════════════════════
// USER JOURNEY EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * User journey event tracking user interactions and behavior
 */
export interface UserJourneyEvent {
  id: number;
  eventType: string;
  eventData: any | null;
  userId: string | null;
  sessionId: string;
  createdAt: Date;
  location: any | null;
  userAgent: string | null;
  isMobile: boolean | null;
  locale: string | null;
}
