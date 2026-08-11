// Presence helpers shared across the app

// How long a user can be inactive before we mark them "away"
export const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// How long without a heartbeat before we treat a contact as "offline"
// (covers closed tabs, lost connection, crashed app, etc.)
export const OFFLINE_THRESHOLD_MS = 60 * 1000; // 1 minute

// How often we ping the server to keep our presence fresh
export const HEARTBEAT_INTERVAL_MS = 20 * 1000; // 20 seconds

// Given a reported status + last heartbeat time, work out what to actually show.
// A stale heartbeat always wins - a contact who stopped sending heartbeats is offline,
// regardless of what their last reported status was.
export const getEffectiveStatus = (status, lastActive) => {
  if (!lastActive) return 'offline';

  const elapsed = Date.now() - new Date(lastActive).getTime();
  if (elapsed > OFFLINE_THRESHOLD_MS) return 'offline';

  return status === 'away' ? 'away' : 'online';
};

export const STATUS_LABELS = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
};
