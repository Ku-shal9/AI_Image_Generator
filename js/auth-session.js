/**
 * auth-session.js - Session get/set/clear, getCurrentUser, isLoggedIn, isAdmin
 */

function saveSession(user) {
  const session = {
    id: user.id,
    username: user.username,
    role: user.role,
    loginTime: Date.now(),
  };
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
}

function getSession() {
  const data = localStorage.getItem(STORAGE_KEYS.SESSION);
  return data ? JSON.parse(data) : null;
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  return findUserById(session.id);
}

function isLoggedIn() {
  return getSession() !== null;
}

function isAdmin() {
  const session = getSession();
  return session && session.role === "admin";
}
