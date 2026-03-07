/**
 * auth-nav.js - requireAuth, requireAdmin, redirectIfLoggedIn, updateNavbarForUser
 */

function requireAuth() {
  if (!isLoggedIn() && !isGuest()) {
    window.location.href = "../html/signin.html";
  }
}

function requireAdmin() {
  if (!isLoggedIn() || !isAdmin()) {
    window.location.href = "../html/signin.html";
  }
}

function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = "../index.html";
  }
}

function updateNavbarForUser() {
  const session = getSession();
  const userInfoEl = document.getElementById("navUserInfo");
  const signOutBtn = document.getElementById("navSignOutBtn");

  if (userInfoEl && session) {
    userInfoEl.textContent = `[${session.role.toUpperCase()}] ${session.username}`;
  }

  if (signOutBtn) {
    signOutBtn.addEventListener("click", signOut);
  }
}
