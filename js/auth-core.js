/**
 * auth-core.js - signIn, signOut, rate limit, prompt history, gallery helpers
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

  saveSession(user);
  return { success: true, message: "Signed in successfully.", user };
}

function signOut() {
  clearSession();
  const path = window.location.pathname || "";

  if (path.includes("/html/")) {
    window.location.href = "signin.html";
  } else {
    window.location.href = "html/signin.html";
  }
}

function checkRateLimit() {
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

function incrementGenerationCount() {
  if (isGuest()) {
    incrementGuestGenerationCount();
    return;
  }
  const user = getCurrentUser();
  if (!user) return;
  updateUser(user.id, { generationsUsed: (user.generationsUsed || 0) + 1 });
}

function getUserPromptHistory() {
  const user = getCurrentUser();
  if (!user) return [];
  return user.promptHistory || [];
}

function addToPromptHistory(prompt) {
  const user = getCurrentUser();
  if (!user) return;

  const history = user.promptHistory || [];

  if (history.length > 0 && history[0].prompt === prompt) return;

  history.unshift({ prompt, timestamp: Date.now() });
  if (history.length > 50) history.pop();

  updateUser(user.id, { promptHistory: history });
}

function clearPromptHistory() {
  const user = getCurrentUser();
  if (!user) return;
  updateUser(user.id, { promptHistory: [] });
}

function getUserGalleryImages() {
  const user = getCurrentUser();
  if (!user) return [];
  return user.galleryImages || [];
}

function addToUserGallery(imageData) {
  const user = getCurrentUser();
  if (!user) return;

  const images = user.galleryImages || [];
  images.unshift(imageData);
  updateUser(user.id, { galleryImages: images });
}

function deleteFromUserGallery(index) {
  const user = getCurrentUser();
  if (!user) return;

  const images = user.galleryImages || [];
  images.splice(index, 1);
  updateUser(user.id, { galleryImages: images });
}

function clearUserGallery() {
  const user = getCurrentUser();
  if (!user) return;
  updateUser(user.id, { galleryImages: [] });
}
