/**
 * admin.js - Photo Galli Admin Panel Logic
 * Handles user management, viewing prompt histories, gallery images,
 * and setting rate limits for users.
 *
 * Depends on: auth.js (must be loaded first)
 */

// ============================================================
// DOM ELEMENT REFERENCES
// ============================================================

/** Stats: total users count */
const statTotalUsers = document.getElementById("statTotalUsers");

/** Stats: total images generated */
const statTotalImages = document.getElementById("statTotalImages");

/** Stats: total prompts submitted */
const statTotalPrompts = document.getElementById("statTotalPrompts");

/** The users table body */
const usersTableBody = document.getElementById("usersTableBody");

/** Create user form */
const createUserForm = document.getElementById("createUserForm");

/** Create user username input */
const newUsername = document.getElementById("newUsername");

/** Create user password input */
const newPassword = document.getElementById("newPassword");

/** Create user role select */
const newRole = document.getElementById("newRole");

/** Create user submit button */
const createUserBtn = document.getElementById("createUserBtn");

/** Create user feedback message */
const createUserMsg = document.getElementById("createUserMsg");

/** User detail modal */
const userDetailModal = document.getElementById("userDetailModal");

/** User detail modal title */
const userDetailTitle = document.getElementById("userDetailTitle");

/** User detail prompt history list */
const userDetailHistory = document.getElementById("userDetailHistory");

/** User detail gallery grid */
const userDetailGallery = document.getElementById("userDetailGallery");

/** Close button for user detail modal */
const userDetailClose = document.getElementById("userDetailClose");

// ============================================================
// UTILITY
// ============================================================

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Formats a Unix timestamp into a readable date string.
 * @param {number} timestamp
 * @returns {string}
 */
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ============================================================
// STATS
// ============================================================

/**
 * Calculates and renders the admin dashboard statistics.
 * Shows total users, total images generated, and total prompts.
 */
function renderStats() {
  const users = getAllUsers();

  // Count non-admin users
  const regularUsers = users.filter((u) => u.role === "user");

  // Sum up all images and prompts across all users
  let totalImages = 0;
  let totalPrompts = 0;

  users.forEach(function (user) {
    totalImages += (user.galleryImages || []).length;
    totalPrompts += (user.promptHistory || []).length;
  });

  if (statTotalUsers) statTotalUsers.textContent = regularUsers.length;
  if (statTotalImages) statTotalImages.textContent = totalImages;
  if (statTotalPrompts) statTotalPrompts.textContent = totalPrompts;
}

// ============================================================
// USERS TABLE
// ============================================================

/**
 * Renders the users management table.
 * Shows each user's username, role, generations used vs limit,
 * and action buttons (view details, set rate limit, delete).
 */
function renderUsersTable() {
  if (!usersTableBody) return;

  const users = getAllUsers();
  usersTableBody.innerHTML = "";

  users.forEach(function (user) {
    const row = document.createElement("tr");

    // Determine rate limit badge class
    const used = user.generationsUsed || 0;
    const limit = user.rateLimit || DEFAULT_RATE_LIMIT;
    const pct = limit > 0 ? (used / limit) * 100 : 0;

    let badgeClass = "rate-limit-ok";
    let badgeLabel = `${used}/${limit}`;

    if (pct >= 100) {
      badgeClass = "rate-limit-exceeded";
    } else if (pct >= 70) {
      badgeClass = "rate-limit-warn";
    }

    // Don't show delete for admin accounts
    const isAdminUser = user.role === "admin";
    const deleteBtn = isAdminUser
      ? '<span class="text-muted-color" style="font-size:0.75rem;">Protected</span>'
      : `<button class="btn-retro btn-retro-danger btn-retro-sm" onclick="handleDeleteUser('${user.id}')">✕ Delete</button>`;

    row.innerHTML = `
      <td>
        <strong>${escapeHtml(user.username)}</strong>
      </td>
      <td>
        <span style="
          font-size: 0.75rem;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          background: ${user.role === "admin" ? "rgba(255,107,53,0.15)" : "rgba(0,255,136,0.1)"};
          color: ${user.role === "admin" ? "var(--accent-secondary)" : "var(--accent-primary)"};
          border: 1px solid ${user.role === "admin" ? "var(--accent-secondary)" : "var(--accent-primary)"};
          font-weight: 700;
          text-transform: uppercase;
        ">${user.role}</span>
      </td>
      <td>
        <span class="rate-limit-badge ${badgeClass}">${badgeLabel}</span>
      </td>
      <td>${(user.galleryImages || []).length}</td>
      <td>${formatDate(user.createdAt)}</td>
      <td>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <button class="btn-retro btn-retro-cyan btn-retro-sm" onclick="openUserDetail('${user.id}')">👁 View</button>
          ${!isAdminUser ? `<button class="btn-retro btn-retro-ghost btn-retro-sm" onclick="promptSetRateLimit('${user.id}', ${limit})">⚙ Limit</button>` : ""}
          ${deleteBtn}
        </div>
      </td>
    `;

    usersTableBody.appendChild(row);
  });
}

// ============================================================
// CREATE USER
// ============================================================

/**
 * Handles the create user form submission.
 * Validates input and calls createUser() from auth.js.
 */
function handleCreateUser(e) {
  e.preventDefault();

  const username = newUsername ? newUsername.value.trim() : "";
  const password = newPassword ? newPassword.value.trim() : "";
  const role = newRole ? newRole.value : "user";

  if (!username || !password) {
    showCreateUserMsg("Username and password are required.", "danger");
    return;
  }

  if (username.length < 3) {
    showCreateUserMsg("Username must be at least 3 characters.", "danger");
    return;
  }

  if (password.length < 4) {
    showCreateUserMsg("Password must be at least 4 characters.", "danger");
    return;
  }

  const result = createUser(username, password, role);

  if (result.success) {
    showCreateUserMsg(`User "${username}" created successfully!`, "success");
    // Clear form
    if (newUsername) newUsername.value = "";
    if (newPassword) newPassword.value = "";
    // Refresh table and stats
    renderUsersTable();
    renderStats();
  } else {
    showCreateUserMsg(result.message, "danger");
  }
}

/**
 * Shows a feedback message below the create user form.
 * @param {string} message
 * @param {'success'|'danger'} type
 */
function showCreateUserMsg(message, type) {
  if (!createUserMsg) return;
  createUserMsg.textContent = message;
  createUserMsg.className = `alert-retro alert-retro-${type}`;
  createUserMsg.classList.remove("d-none");

  // Auto-hide after 4 seconds
  setTimeout(function () {
    createUserMsg.classList.add("d-none");
  }, 4000);
}

// ============================================================
// DELETE USER
// ============================================================

/**
 * Handles deleting a user after confirmation.
 * @param {string} userId
 */
function handleDeleteUser(userId) {
  const user = findUserById(userId);
  if (!user) return;

  if (
    !confirm(`Delete user "${user.username}"? This will remove all their data.`)
  )
    return;

  const result = deleteUser(userId);

  if (result.success) {
    renderUsersTable();
    renderStats();
  } else {
    alert(result.message);
  }
}

// ============================================================
// SET RATE LIMIT
// ============================================================

/**
 * Prompts the admin to enter a new rate limit for a user.
 * @param {string} userId
 * @param {number} currentLimit
 */
function promptSetRateLimit(userId, currentLimit) {
  const input = prompt(
    `Set new generation limit for this user (current: ${currentLimit}):`,
    currentLimit,
  );

  if (input === null) return; // Cancelled

  const newLimit = parseInt(input, 10);

  if (isNaN(newLimit) || newLimit < 0) {
    alert("Please enter a valid number (0 or greater).");
    return;
  }

  setUserRateLimit(userId, newLimit);
  renderUsersTable();
}

// ============================================================
// USER DETAIL MODAL
// ============================================================

/**
 * Opens the user detail modal showing their prompt history and gallery.
 * @param {string} userId
 */
function openUserDetail(userId) {
  const user = findUserById(userId);
  if (!user || !userDetailModal) return;

  // Set title
  if (userDetailTitle) {
    userDetailTitle.textContent = `${user.username}'s Details`;
  }

  // Render prompt history
  if (userDetailHistory) {
    const history = user.promptHistory || [];
    if (history.length === 0) {
      userDetailHistory.innerHTML =
        '<p class="text-muted-color" style="font-size:0.85rem;">No prompt history yet.</p>';
    } else {
      userDetailHistory.innerHTML = history
        .map(function (entry) {
          return `
          <div style="
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 0.6rem 0.8rem;
            margin-bottom: 0.5rem;
            font-size: 0.82rem;
          ">
            <div style="color: var(--text-primary); margin-bottom: 0.2rem;">"${escapeHtml(entry.prompt)}"</div>
            <div style="color: var(--text-muted); font-size: 0.72rem;">${formatDate(entry.timestamp)}</div>
          </div>
        `;
        })
        .join("");
    }
  }

  // Render gallery thumbnails
  if (userDetailGallery) {
    const images = user.galleryImages || [];
    if (images.length === 0) {
      userDetailGallery.innerHTML =
        '<p class="text-muted-color" style="font-size:0.85rem;">No images saved yet.</p>';
    } else {
      userDetailGallery.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap:0.75rem;">
          ${images
            .map(function (img) {
              return `
              <div style="border-radius:6px; overflow:hidden; border:1px solid var(--border-color);">
                <img
                  src="${escapeHtml(img.url)}"
                  alt="${escapeHtml(img.prompt)}"
                  style="width:100%; height:100px; object-fit:cover; display:block;"
                  loading="lazy"
                  title="${escapeHtml(img.prompt)}"
                />
              </div>
            `;
            })
            .join("")}
        </div>
      `;
    }
  }

  // Show modal
  userDetailModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

/**
 * Closes the user detail modal.
 */
function closeUserDetail() {
  if (userDetailModal) {
    userDetailModal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// Create user form
if (createUserForm) {
  createUserForm.addEventListener("submit", handleCreateUser);
}

// Close user detail modal
if (userDetailClose) {
  userDetailClose.addEventListener("click", closeUserDetail);
}

if (userDetailModal) {
  userDetailModal.addEventListener("click", function (e) {
    if (e.target === userDetailModal) closeUserDetail();
  });
}

// Escape key closes modal
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeUserDetail();
});

// Theme toggle
const themeToggleBtn = document.getElementById("themeToggleBtn");
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", toggleTheme);
}

// Sign out
const signOutBtn = document.getElementById("navSignOutBtn");
if (signOutBtn) {
  signOutBtn.addEventListener("click", signOut);
}

// ============================================================
// INITIALIZE ADMIN PAGE
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  // Guard: must be admin
  requireAdmin();

  // Apply saved theme
  loadTheme();

  // Update navbar
  updateNavbarForUser();

  // Update theme button text
  const isLight = document.body.classList.contains("light-mode");
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isLight ? "🌙 Dark" : "☀️ Light";
  }

  // Render dashboard
  renderStats();
  renderUsersTable();

  console.log("[Photo Galli] Admin page initialized.");
});
