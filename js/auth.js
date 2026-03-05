/**
 * auth.js - Photo Galli Authentication Module
 * Handles user/admin sign-in, session management, and user data via localStorage.
 *
 * Roles:
 *   - admin: pre-seeded, can manage users, view all history, set rate limits
 *   - user: registered user; plan determines generation limit
 *   - guest: temporary session; limited to GUEST_FREE_LIMIT generations before upgrade required
 *
 * Plans:
 *   - free / guest: 2 generations
 *   - starter: 30 generations / month
 *   - pro: 100 generations / month
 *   - unlimited: no limit
 */

// ============================================================
// CONSTANTS
// ============================================================

/** Storage keys used across the app */
const STORAGE_KEYS = {
  USERS: "pg_users",
  SESSION: "pg_session",
  THEME: "pg_theme",
  GUEST_GENS: "pg_guest_gens",
};

/** Default rate limit for new registered users (free plan) */
const DEFAULT_RATE_LIMIT = 6;

/** Guest users get this many free generations before upgrade prompt */
const GUEST_FREE_LIMIT = 2;

/**
 * Plan definitions: name, generation limit, price display.
 * Used by the pricing page and rate-limit checks.
 */
const PLANS = {
  guest: { name: "Guest", limit: 2, price: 0 },
  free: { name: "Free", limit: 6, price: 0 },
  starter: { name: "Starter", limit: 30, price: 4.99 },
  pro: { name: "Pro", limit: 100, price: 9.99 },
  unlimited: { name: "Unlimited", limit: 9999, price: 19.99 },
};

// ============================================================
// GUEST MODE
// ============================================================

/**
 * Starts a guest session (no account required).
 * Guest gets GUEST_FREE_LIMIT free generations.
 */
function startGuestSession() {
  const guestSession = {
    id: "guest-" + Date.now(),
    username: "Guest",
    role: "guest",
    loginTime: Date.now(),
  };
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(guestSession));
  // Reset guest generation count
  localStorage.setItem(STORAGE_KEYS.GUEST_GENS, "0");
}

/**
 * Checks if the current session is a guest session.
 * @returns {boolean}
 */
function isGuest() {
  const session = getSession();
  return session && session.role === "guest";
}

/**
 * Gets the number of generations used in the current guest session.
 * @returns {number}
 */
function getGuestGenerationsUsed() {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEYS.GUEST_GENS) || "0", 10);
  } catch (_) {
    return 0;
  }
}

/**
 * Increments the guest generation counter.
 */
function incrementGuestGenerationCount() {
  const current = getGuestGenerationsUsed();
  localStorage.setItem(STORAGE_KEYS.GUEST_GENS, String(current + 1));
}

// ============================================================
// INITIAL DATA SETUP
// ============================================================

/**
 * Seeds the admin account and a demo user if no users exist yet.
 * Called once on app load.
 */
function seedInitialData() {
  const existing = localStorage.getItem(STORAGE_KEYS.USERS);
  if (existing) return; // Already seeded

  // Pre-configured admin account
  const initialUsers = [
    {
      id: "admin-001",
      username: "admin",
      password: "admin123", // In a real app, this would be hashed
      role: "admin",
      createdAt: Date.now(),
      generationsUsed: 0,
      rateLimit: 999, // Admin has effectively unlimited generations
      promptHistory: [],
      galleryImages: [],
    },
    {
      id: "user-demo",
      username: "demo",
      password: "demo123",
      role: "user",
      createdAt: Date.now(),
      generationsUsed: 0,
      rateLimit: DEFAULT_RATE_LIMIT,
      promptHistory: [],
      galleryImages: [],
    },
  ];

  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
}

// ============================================================
// USER CRUD HELPERS
// ============================================================

/**
 * Retrieves all users from localStorage.
 * @returns {Array} Array of user objects
 */
function getAllUsers() {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  return data ? JSON.parse(data) : [];
}

/**
 * Saves the full users array back to localStorage.
 * @param {Array} users - Array of user objects
 */
function saveAllUsers(users) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

/**
 * Finds a user by their username (case-insensitive).
 * @param {string} username
 * @returns {Object|null} User object or null
 */
function findUserByUsername(username) {
  const users = getAllUsers();
  return (
    users.find((u) => u.username.toLowerCase() === username.toLowerCase()) ||
    null
  );
}

/**
 * Finds a user by their ID.
 * @param {string} id
 * @returns {Object|null} User object or null
 */
function findUserById(id) {
  const users = getAllUsers();
  return users.find((u) => u.id === id) || null;
}

/**
 * Updates a specific user's data in localStorage.
 * @param {string} userId - The user's ID
 * @param {Object} updates - Partial object with fields to update
 */
function updateUser(userId, updates) {
  const users = getAllUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return;
  users[idx] = { ...users[idx], ...updates };
  saveAllUsers(users);
}

/**
 * Creates a new user account (admin only action).
 * @param {string} username
 * @param {string} password
 * @param {string} role - 'user' or 'admin'
 * @returns {{ success: boolean, message: string, user?: Object }}
 */
function createUser(username, password, role = "user") {
  if (!username || !password) {
    return { success: false, message: "Username and password are required." };
  }

  // Check for duplicate username
  if (findUserByUsername(username)) {
    return { success: false, message: "Username already exists." };
  }

  const newUser = {
    id: "user-" + Date.now(),
    username: username.trim(),
    password: password,
    role: role,
    createdAt: Date.now(),
    generationsUsed: 0,
    rateLimit: role === "admin" ? 999 : DEFAULT_RATE_LIMIT,
    promptHistory: [],
    galleryImages: [],
  };

  const users = getAllUsers();
  users.push(newUser);
  saveAllUsers(users);

  return {
    success: true,
    message: "User created successfully.",
    user: newUser,
  };
}

/**
 * Deletes a user by ID (admin only).
 * @param {string} userId
 * @returns {{ success: boolean, message: string }}
 */
function deleteUser(userId) {
  const users = getAllUsers();
  const filtered = users.filter((u) => u.id !== userId);

  if (filtered.length === users.length) {
    return { success: false, message: "User not found." };
  }

  saveAllUsers(filtered);
  return { success: true, message: "User deleted." };
}

/**
 * Updates the rate limit for a specific user (admin only).
 * @param {string} userId
 * @param {number} newLimit
 */
function setUserRateLimit(userId, newLimit) {
  updateUser(userId, { rateLimit: parseInt(newLimit, 10) });
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================

/**
 * Saves the current session to localStorage.
 * @param {Object} user - The authenticated user object
 */
function saveSession(user) {
  // Store only non-sensitive session info
  const session = {
    id: user.id,
    username: user.username,
    role: user.role,
    loginTime: Date.now(),
  };
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
}

/**
 * Retrieves the current session from localStorage.
 * @returns {Object|null} Session object or null if not logged in
 */
function getSession() {
  const data = localStorage.getItem(STORAGE_KEYS.SESSION);
  return data ? JSON.parse(data) : null;
}

/**
 * Clears the current session (sign out).
 */
function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

/**
 * Returns the currently logged-in user's full data.
 * @returns {Object|null}
 */
function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  return findUserById(session.id);
}

/**
 * Checks if a user is currently logged in.
 * @returns {boolean}
 */
function isLoggedIn() {
  return getSession() !== null;
}

/**
 * Checks if the current user is an admin.
 * @returns {boolean}
 */
function isAdmin() {
  const session = getSession();
  return session && session.role === "admin";
}

// ============================================================
// AUTHENTICATION
// ============================================================

/**
 * Attempts to sign in a user with the given credentials.
 * @param {string} username
 * @param {string} password
 * @param {string} role - Expected role ('user' or 'admin')
 * @returns {{ success: boolean, message: string, user?: Object }}
 */
function signIn(username, password, role) {
  const user = findUserByUsername(username);

  if (!user) {
    return { success: false, message: "Invalid username or password." };
  }

  if (user.password !== password) {
    return { success: false, message: "Invalid username or password." };
  }

  if (user.role !== role) {
    return {
      success: false,
      message: `This account is not a ${role} account. Please select the correct role.`,
    };
  }

  // Save session
  saveSession(user);
  return { success: true, message: "Signed in successfully.", user };
}

/**
 * Signs out the current user and redirects to sign-in page.
 */
function signOut() {
  clearSession();
  const path = window.location.pathname || "";

  // If we're already inside /html/, go to the local signin file.
  if (path.includes("/html/")) {
    window.location.href = "signin.html";
  } else {
    // From root pages like index.html
    window.location.href = "html/signin.html";
  }
}

// ============================================================
// RATE LIMIT HELPERS
// ============================================================

/**
 * Checks if the current user (or guest) has remaining generations.
 * @returns {{ allowed: boolean, used: number, limit: number, remaining: number, isGuest: boolean }}
 */
function checkRateLimit() {
  // Guest mode: check guest generation counter
  if (isGuest()) {
    const used = getGuestGenerationsUsed();
    const limit = GUEST_FREE_LIMIT;
    const remaining = Math.max(0, limit - used);
    return { allowed: used < limit, used, limit, remaining, isGuest: true };
  }

  const user = getCurrentUser();
  if (!user)
    return { allowed: false, used: 0, limit: 0, remaining: 0, isGuest: false };

  const used = user.generationsUsed || 0;
  // Admin and unlimited plan users have no cap
  const plan = user.plan || "free";
  const planLimit = PLANS[plan] ? PLANS[plan].limit : DEFAULT_RATE_LIMIT;
  const limit = user.rateLimit !== undefined ? user.rateLimit : planLimit;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    isGuest: false,
  };
}

/**
 * Increments the generation count for the current user or guest.
 */
function incrementGenerationCount() {
  if (isGuest()) {
    incrementGuestGenerationCount();
    return;
  }
  const user = getCurrentUser();
  if (!user) return;
  updateUser(user.id, { generationsUsed: (user.generationsUsed || 0) + 1 });
}

// ============================================================
// USER DATA (prompt history & gallery images)
// ============================================================

/**
 * Gets the prompt history for the current user.
 * @returns {Array} Array of prompt history objects { prompt, timestamp }
 */
function getUserPromptHistory() {
  const user = getCurrentUser();
  if (!user) return [];
  return user.promptHistory || [];
}

/**
 * Adds a prompt to the current user's history.
 * @param {string} prompt
 */
function addToPromptHistory(prompt) {
  const user = getCurrentUser();
  if (!user) return;

  const history = user.promptHistory || [];

  // Avoid duplicate consecutive prompts
  if (history.length > 0 && history[0].prompt === prompt) return;

  // Add to front, keep max 50 entries
  history.unshift({ prompt, timestamp: Date.now() });
  if (history.length > 50) history.pop();

  updateUser(user.id, { promptHistory: history });
}

/**
 * Clears the current user's prompt history.
 */
function clearPromptHistory() {
  const user = getCurrentUser();
  if (!user) return;
  updateUser(user.id, { promptHistory: [] });
}

/**
 * Gets the gallery images for the current user.
 * @returns {Array} Array of image objects { url, prompt, timestamp, source }
 */
function getUserGalleryImages() {
  const user = getCurrentUser();
  if (!user) return [];
  return user.galleryImages || [];
}

/**
 * Adds an image to the current user's gallery.
 * @param {Object} imageData - { url, prompt, timestamp, source }
 */
function addToUserGallery(imageData) {
  const user = getCurrentUser();
  if (!user) return;

  const images = user.galleryImages || [];
  images.unshift(imageData); // Newest first
  updateUser(user.id, { galleryImages: images });
}

/**
 * Deletes an image from the current user's gallery by index.
 * @param {number} index
 */
function deleteFromUserGallery(index) {
  const user = getCurrentUser();
  if (!user) return;

  const images = user.galleryImages || [];
  images.splice(index, 1);
  updateUser(user.id, { galleryImages: images });
}

/**
 * Clears all images from the current user's gallery.
 */
function clearUserGallery() {
  const user = getCurrentUser();
  if (!user) return;
  updateUser(user.id, { galleryImages: [] });
}

// ============================================================
// THEME MANAGEMENT
// ============================================================

/**
 * Loads the saved theme preference and applies it.
 */
function loadTheme() {
  const theme = localStorage.getItem(STORAGE_KEYS.THEME);
  if (theme === "light") {
    document.body.classList.add("light-mode");
  } else {
    document.body.classList.remove("light-mode");
  }
}

/**
 * Toggles between dark and light mode.
 */
function toggleTheme() {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem(STORAGE_KEYS.THEME, isLight ? "light" : "dark");

  // Update toggle button text if it exists
  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    btn.textContent = isLight ? "🌙 Dark" : "☀️ Light";
  }
}

// ============================================================
// NAVIGATION GUARD
// ============================================================

/**
 * Redirects to sign-in if user is not authenticated (and not a guest).
 * Call this at the top of protected pages.
 */
function requireAuth() {
  if (!isLoggedIn() && !isGuest()) {
    window.location.href = "../html/signin.html";
  }
}

/**
 * Redirects to sign-in if user is not an admin.
 * Call this at the top of admin-only pages.
 */
function requireAdmin() {
  if (!isLoggedIn() || !isAdmin()) {
    window.location.href = "../html/signin.html";
  }
}

/**
 * Redirects to home if user is already logged in.
 * Call this on the sign-in page.
 */
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = "../index.html";
  }
}

// ============================================================
// NAVBAR HELPERS
// ============================================================

/**
 * Updates the navbar to show the current user's name and a sign-out button.
 * Should be called on every protected page after DOM loads.
 */
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

// ============================================================
// PROFILE FUNCTIONS
// ============================================================

/**
 * Gets the profile picture URL for a user.
 * @param {string} userId
 * @returns {string|null} Profile picture URL or null if not set
 */
function getUserProfilePicture(userId) {
  const key = `pg_profile_pic_${userId}`;
  const perUser = localStorage.getItem(key);
  if (perUser) return perUser;

  // Legacy support: older builds stored a single shared key.
  // Migrate it to the current user the first time we see it.
  const legacy = localStorage.getItem("pg_profile_pic");
  if (legacy) {
    localStorage.setItem(key, legacy);
    localStorage.removeItem("pg_profile_pic");
    return legacy;
  }

  return null;
}

/**
 * Saves a profile picture for a user (base64 encoded).
 * @param {string} userId
 * @param {string} base64Image - Base64 encoded image data
 */
function saveUserProfilePicture(userId, base64Image) {
  const key = `pg_profile_pic_${userId}`;
  localStorage.setItem(key, base64Image);
}

/**
 * Removes a user's profile picture.
 * @param {string} userId
 */
function removeUserProfilePicture(userId) {
  const key = `pg_profile_pic_${userId}`;
  localStorage.removeItem(key);
}

/**
 * Changes the current user's password.
 * @param {string} oldPassword
 * @param {string} newPassword
 * @returns {{ success: boolean, message: string }}
 */
function changeUserPassword(oldPassword, newPassword) {
  const user = getCurrentUser();
  if (!user) {
    return { success: false, message: "Not logged in." };
  }

  // Verify old password
  if (user.password !== oldPassword) {
    return { success: false, message: "Current password is incorrect." };
  }

  // Validate new password
  if (!newPassword || newPassword.length < 4) {
    return {
      success: false,
      message: "New password must be at least 4 characters.",
    };
  }

  // Update password
  updateUser(user.id, { password: newPassword });

  return { success: true, message: "Password changed successfully." };
}

/**
 * Updates the navbar to show profile avatar instead of text.
 * Call this on page load after DOM is ready.
 */
function updateNavbarProfile() {
  const session = getSession();
  const profileBtn = document.getElementById("profileBtn");
  const navProfileImg = document.getElementById("navProfileImg");
  const navProfileInitial = document.getElementById("navProfileInitial");

  if (!profileBtn || !session) return;

  const profilePic = getUserProfilePicture(session.id);
  const initial = session.username.charAt(0).toUpperCase();

  if (profilePic && navProfileImg && navProfileInitial) {
    navProfileImg.src = profilePic;
    navProfileImg.style.display = "block";
    navProfileInitial.style.display = "none";
  } else if (navProfileImg && navProfileInitial) {
    navProfileImg.style.display = "none";
    navProfileInitial.textContent = initial;
    navProfileInitial.style.display = "block";
  }
}

// ============================================================
// INITIALIZE
// ============================================================

// Seed initial data when this script loads
seedInitialData();
