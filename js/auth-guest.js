/**
 * auth-guest.js - Guest session start, isGuest, guest generation count
 */

function startGuestSession() {
  const guestSession = {
    id: "guest-" + Date.now(),
    username: "Guest",
    role: "guest",
    loginTime: Date.now(),
  };
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(guestSession));
  localStorage.setItem(STORAGE_KEYS.GUEST_GENS, "0");
}

function isGuest() {
  const session = getSession();
  return session && session.role === "guest";
}

function getGuestGenerationsUsed() {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEYS.GUEST_GENS) || "0", 10);
  } catch (_) {
    return 0;
  }
}

function incrementGuestGenerationCount() {
  const current = getGuestGenerationsUsed();
  localStorage.setItem(STORAGE_KEYS.GUEST_GENS, String(current + 1));
}
