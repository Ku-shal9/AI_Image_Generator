/**
 * gallery.js - Photo Galli Photos Page Logic
 * Handles displaying the user's saved gallery images in a grid,
 * image modal (click to view full with prompt), delete, and download.
 *
 * Depends on: auth.js (must be loaded first)
 */

// ============================================================
// DOM ELEMENT REFERENCES
// ============================================================

/** The grid container where gallery cards are rendered */
const galleryGrid = document.getElementById("galleryGrid");

/** Empty state shown when no images exist */
const galleryEmptyState = document.getElementById("galleryEmptyState");

/** Modal overlay for full-size image view */
const imageModal = document.getElementById("imageModal");

/** The full-size image inside the modal */
const modalImg = document.getElementById("modalImg");

/** The prompt text inside the modal */
const modalPromptText = document.getElementById("modalPromptText");

/** The date text inside the modal */
const modalDateText = document.getElementById("modalDateText");

/** Download button inside the modal */
const modalDownloadBtn = document.getElementById("modalDownloadBtn");

/** Delete button inside the modal */
const modalDeleteBtn = document.getElementById("modalDeleteBtn");

/** Close button for the modal */
const modalCloseBtn = document.getElementById("modalCloseBtn");

/** Clear all images button */
const clearAllBtn = document.getElementById("clearAllBtn");

// ============================================================
// STATE
// ============================================================

/** Index of the currently viewed image in the modal */
let currentModalIndex = -1;

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
 * Formats a Unix timestamp into a human-readable date string.
 * @param {number} timestamp
 * @returns {string}
 */
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// GALLERY RENDERING
// ============================================================

/**
 * Renders all gallery images for the current user.
 * Uses CSS Grid (defined in style.css) for the layout.
 * Each card shows the image, a truncated prompt, and the date.
 */
function renderGallery(searchQuery = "") {
  if (!galleryGrid) return;

  const allImages = getUserGalleryImages();
  const query = searchQuery.trim().toLowerCase();
  const images = (query
    ? allImages.filter(function (img) {
        return (img.prompt || "").toLowerCase().includes(query);
      })
    : allImages
  ).filter(function (img) {
    // Skip any stale blob: URLs that cannot be loaded on a new page
    return img.url && !String(img.url).startsWith("blob:");
  });
  galleryGrid.innerHTML = "";

  if (images.length === 0) {
    // Show empty state
    if (galleryEmptyState) galleryEmptyState.classList.remove("d-none");
    if (clearAllBtn) clearAllBtn.classList.add("d-none");
    return;
  }

  // Hide empty state, show clear button
  if (galleryEmptyState) galleryEmptyState.classList.add("d-none");
  if (clearAllBtn) clearAllBtn.classList.remove("d-none");

  // Build a card for each image
  images.forEach(function (imgData, index) {
    const card = createGalleryCard(imgData, index);
    galleryGrid.appendChild(card);
  });
}

/**
 * Creates a single gallery card element.
 * @param {Object} imgData - { url, prompt, timestamp, source }
 * @param {number} index - Position in the gallery array
 * @returns {HTMLElement} The card element
 */
function createGalleryCard(imgData, index) {
  const card = document.createElement("div");
  card.className = "gallery-card";
  card.dataset.index = index;

  // Format date for display
  const dateStr = formatDate(imgData.timestamp);

  card.innerHTML = `
    <img
      class="gallery-card-img"
      src="${escapeHtml(imgData.url)}"
      alt="${escapeHtml(imgData.prompt)}"
      loading="lazy"
    />
    <div class="gallery-card-body">
      <div class="gallery-card-prompt">"${escapeHtml(imgData.prompt)}"</div>
      <div class="gallery-card-date">📅 ${dateStr}</div>
    </div>
    <div class="gallery-card-actions">
      <a
        href="${escapeHtml(imgData.url)}"
        download="photogalli-${imgData.timestamp}.png"
        class="btn-retro btn-retro-cyan btn-retro-sm"
        onclick="event.stopPropagation()"
      >⬇ Download</a>
      <button
        class="btn-retro btn-retro-danger btn-retro-sm"
        data-delete-index="${index}"
        onclick="event.stopPropagation(); handleDeleteImage(${index})"
      >✕ Delete</button>
    </div>
  `;

  // Click on the card (not buttons) opens the modal
  card.addEventListener("click", function (e) {
    // Don't open modal if clicking action buttons
    if (e.target.closest(".gallery-card-actions")) return;
    openModal(index);
  });

  return card;
}

// ============================================================
// IMAGE MODAL
// ============================================================

/**
 * Opens the image modal for the given gallery index.
 * Shows the full image, prompt, date, and action buttons.
 * @param {number} index - Index in the user's gallery array
 */
function openModal(index) {
  const images = getUserGalleryImages();
  if (index < 0 || index >= images.length) return;

  const imgData = images[index];
  currentModalIndex = index;

  // Populate modal content
  if (modalImg) {
    modalImg.src = imgData.url;
    modalImg.alt = imgData.prompt;
  }

  if (modalPromptText) {
    modalPromptText.textContent = `"${imgData.prompt}"`;
  }

  if (modalDateText) {
    modalDateText.textContent = `Generated on ${formatDate(imgData.timestamp)}`;
  }

  if (modalDownloadBtn) {
    modalDownloadBtn.href = imgData.url;
    modalDownloadBtn.download = `photogalli-${imgData.timestamp}.png`;
  }

  // Show the modal
  if (imageModal) {
    imageModal.classList.add("active");
    document.body.style.overflow = "hidden"; // Prevent background scroll
  }
}

/**
 * Closes the image modal.
 */
function closeModal() {
  if (imageModal) {
    imageModal.classList.remove("active");
    document.body.style.overflow = "";
  }
  currentModalIndex = -1;
}

// ============================================================
// DELETE IMAGE
// ============================================================

/**
 * Handles deleting an image from the gallery.
 * @param {number} index - Index in the gallery array
 */
function handleDeleteImage(index) {
  if (!confirm("Delete this image from your gallery?")) return;

  deleteFromUserGallery(index);

  // If modal is open for this image, close it
  if (currentModalIndex === index) {
    closeModal();
  }

  // Re-render the gallery
  renderGallery();
}

/**
 * Handles the delete button inside the modal.
 */
function handleModalDelete() {
  if (currentModalIndex === -1) return;
  handleDeleteImage(currentModalIndex);
}

// ============================================================
// CLEAR ALL
// ============================================================

/**
 * Clears all images from the current user's gallery after confirmation.
 */
function handleClearAll() {
  const images = getUserGalleryImages();
  if (images.length === 0) return;

  if (
    !confirm(
      `Delete all ${images.length} image${images.length !== 1 ? "s" : ""} from your gallery? This cannot be undone.`,
    )
  ) {
    return;
  }

  clearUserGallery();
  closeModal();
  renderGallery();
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// Close modal when clicking the close button
if (modalCloseBtn) {
  modalCloseBtn.addEventListener("click", closeModal);
}

// Close modal when clicking the overlay background
if (imageModal) {
  imageModal.addEventListener("click", function (e) {
    // Only close if clicking the overlay itself, not the content
    if (e.target === imageModal) {
      closeModal();
    }
  });
}

// Delete button inside modal
if (modalDeleteBtn) {
  modalDeleteBtn.addEventListener("click", handleModalDelete);
}

// Clear all button
if (clearAllBtn) {
  clearAllBtn.addEventListener("click", handleClearAll);
}

// Close modal with Escape key
document.addEventListener("keydown", function (e) {
  if (
    e.key === "Escape" &&
    imageModal &&
    imageModal.classList.contains("active")
  ) {
    closeModal();
  }
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
// PROFILE MODAL (for Photos Page)
// ============================================================

const profileModal = document.getElementById("profileModal");
const profileBtn = document.getElementById("profileBtn");
const profileCloseBtn = document.getElementById("profileCloseBtn");
const profilePicInput = document.getElementById("profilePicInput");
const changePasswordForm = document.getElementById("changePasswordForm");

function openProfileModal() {
  if (!profileModal) return;
  const user = getCurrentUser();
  if (!user) return;

  document.getElementById("profileUsername").textContent = user.username;
  document.getElementById("profileRole").textContent = user.role;

  const profilePic = getUserProfilePicture(user.id);
  const profileImg = document.getElementById("profileImg");
  const profileInitial = document.getElementById("profileInitial");

  if (profilePic && profileImg && profileInitial) {
    profileImg.src = profilePic;
    profileImg.style.display = "block";
    profileInitial.style.display = "none";
  } else if (profileImg && profileInitial) {
    profileImg.style.display = "none";
    profileInitial.textContent = user.username.charAt(0).toUpperCase();
    profileInitial.style.display = "flex";
  }

  // Update rate limit
  const { used, limit } = checkRateLimit();
  document.getElementById("profileRateUsed").textContent = used;
  document.getElementById("profileRateLimit").textContent = limit;
  const fill = document.getElementById("profileRateFill");
  if (fill) {
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    fill.style.width = pct + "%";
    fill.classList.toggle("exceeded", pct >= 100);
  }

  profileModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeProfileModal() {
  if (!profileModal) return;
  profileModal.classList.remove("active");
  document.body.style.overflow = "";
}

if (profileBtn) profileBtn.addEventListener("click", openProfileModal);
if (profileCloseBtn)
  profileCloseBtn.addEventListener("click", closeProfileModal);
if (profileModal) {
  profileModal.addEventListener("click", function (e) {
    if (e.target === profileModal) closeProfileModal();
  });
}

document.addEventListener("keydown", function (e) {
  if (
    e.key === "Escape" &&
    profileModal &&
    profileModal.classList.contains("active")
  ) {
    closeProfileModal();
  }
});

if (profilePicInput) {
  profilePicInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image size should be less than 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function (event) {
      const user = getCurrentUser();
      if (user) {
        saveUserProfilePicture(user.id, event.target.result);
        updateNavbarProfile();
        openProfileModal(); // Refresh modal
      }
    };
    reader.readAsDataURL(file);
  });
}

if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const oldPass = document.getElementById("oldPassword").value;
    const newPass = document.getElementById("newPasswordChange").value;
    const confirmPass = document.getElementById("confirmPassword").value;
    const msgEl = document.getElementById("passwordChangeMsg");

    if (newPass !== confirmPass) {
      msgEl.textContent = "New passwords do not match.";
      msgEl.className = "alert-retro alert-retro-danger mt-2";
      msgEl.classList.remove("d-none");
      return;
    }

    const result = changeUserPassword(oldPass, newPass);
    msgEl.textContent = result.message;
    msgEl.className = `alert-retro alert-retro-${result.success ? "success" : "danger"} mt-2`;
    msgEl.classList.remove("d-none");

    if (result.success) {
      document.getElementById("oldPassword").value = "";
      document.getElementById("newPasswordChange").value = "";
      document.getElementById("confirmPassword").value = "";
    }
  });
}

// ============================================================
// INITIALIZE PHOTOS PAGE
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  // Guard: must be logged in
  requireAuth();

  // Apply saved theme
  loadTheme();

  // Update navbar
  updateNavbarForUser();

  // Update profile
  updateNavbarProfile();

  // Update theme button text
  const isLight = document.body.classList.contains("light-mode");
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isLight ? "🌙 Dark" : "☀️ Light";
  }

  // Gallery search
  const gallerySearchInput = document.getElementById("gallerySearchInput");
  if (gallerySearchInput) {
    gallerySearchInput.addEventListener("input", function (e) {
      renderGallery(e.target.value || "");
    });
  }

  // Render the gallery
  renderGallery();

  console.log("[Photo Galli] Photos page initialized.");
});
