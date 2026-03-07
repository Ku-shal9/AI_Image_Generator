/**
 * auth-user.js - changeUsername, adminChangeUsername, adminResetPassword, updateUserEmail
 */

function changeUsername(newUsername) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: "Not logged in." };

  const trimmed = newUsername.trim();
  if (!trimmed || trimmed.length < 3) {
    return {
      success: false,
      message: "Username must be at least 3 characters.",
    };
  }

  const existing = findUserByUsername(trimmed);
  if (existing && existing.id !== user.id) {
    return { success: false, message: "Username already taken." };
  }

  updateUser(user.id, { username: trimmed });

  const session = getSession();
  if (session) {
    session.username = trimmed;
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  }

  return { success: true, message: "Username updated successfully." };
}

function adminChangeUsername(userId, newUsername) {
  const trimmed = (newUsername || "").trim();
  if (!trimmed || trimmed.length < 3) {
    return {
      success: false,
      message: "Username must be at least 3 characters.",
    };
  }

  const existing = findUserByUsername(trimmed);
  if (existing && existing.id !== userId) {
    return { success: false, message: "Username already taken." };
  }

  updateUser(userId, { username: trimmed });
  return { success: true, message: "Username updated." };
}

function adminResetPassword(userId, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    return {
      success: false,
      message: "Password must be at least 4 characters.",
    };
  }
  updateUser(userId, { password: newPassword });
  return { success: true, message: "Password reset successfully." };
}

function updateUserEmail(userId, email) {
  const trimmed = (email || "").trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { success: false, message: "Please enter a valid email address." };
  }
  updateUser(userId, { email: trimmed });
  return { success: true, message: "Email updated." };
}
