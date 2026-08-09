export function createRouteAnnouncementTracker() {
  let announcedSessionId: number | null = null;
  let announcedToastId: string | null = null;
  let retiredThroughSessionId = -1;

  return {
    claim(sessionId: number) {
      if (sessionId <= retiredThroughSessionId) return false;
      if (announcedSessionId === sessionId) return false;
      announcedSessionId = sessionId;
      announcedToastId = null;
      return true;
    },

    has(sessionId: number) {
      return announcedSessionId === sessionId;
    },

    register(sessionId: number, toastId: string) {
      if (announcedSessionId === sessionId) announcedToastId = toastId;
    },

    reset(retiredSessionId?: number) {
      const toastId = announcedToastId;
      if (retiredSessionId !== undefined) {
        retiredThroughSessionId = Math.max(retiredThroughSessionId, retiredSessionId);
      }
      announcedSessionId = null;
      announcedToastId = null;
      return toastId;
    },
  };
}
