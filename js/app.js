/**
 * app.js - Home page init: DOM refs, auth, theme, sidebar, rate, event listeners, profile modal
 */
document.addEventListener("DOMContentLoaded", function () {
  promptInput = document.getElementById("promptInput");
  generateBtn = document.getElementById("generateBtn");
  loadingEl = document.getElementById("loadingIndicator");
  errorEl = document.getElementById("errorMessage");
  freshSection = document.getElementById("freshSection");
  freshImg = document.getElementById("freshImg");
  freshPromptText = document.getElementById("freshPromptText");
  freshModelBadge = document.getElementById("freshModelBadge");
  freshDownloadBtn = document.getElementById("freshDownloadBtn");
  freshSaveBtn = document.getElementById("freshSaveBtn");
  rateLimitFill = document.getElementById("rateLimitFill");
  rateLimitText = document.getElementById("rateLimitText");
  sidebarHistoryList = document.getElementById("sidebarHistoryList");
  sidebarEmptyState = document.getElementById("sidebarEmptyState");
  clearHistoryBtn = document.getElementById("clearHistoryBtn");

  requireAuth();

  loadTheme();

  if (isGuest()) {
    const navSignOutBtn = document.getElementById("navSignOutBtn");
    const profileBtn = document.getElementById("profileBtn");
    if (navSignOutBtn) {
      navSignOutBtn.textContent = "🚀 Sign Up";
      navSignOutBtn.onclick = function () {
        window.location.href = "html/signin.html";
      };
    }
    if (profileBtn) profileBtn.style.display = "none";

    const navProfileInitial = document.getElementById("navProfileInitial");
    if (navProfileInitial) {
      navProfileInitial.textContent = "G";
      navProfileInitial.style.display = "block";
      navProfileInitial.title = "Guest Mode";
    }
  } else {
    updateNavbarForUser();
    updateNavbarProfile();
  }

  renderSidebarHistory();

  const historySearchInput = document.getElementById("historySearchInput");
  if (historySearchInput) {
    historySearchInput.addEventListener("input", function (e) {
      renderSidebarHistory(e.target.value || "");
    });
  }

  updateRateLimitUI();

  if (generateBtn) {
    generateBtn.addEventListener("click", generateImage);
  }

  if (promptInput) {
    promptInput.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        generateImage();
      }
    });
  }

  if (freshSaveBtn) {
    freshSaveBtn.addEventListener("click", saveToGallery);
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", function () {
      if (confirm("Clear all prompt history?")) {
        clearPromptHistory();
        renderSidebarHistory();
      }
    });
  }

  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme);
  }

  const signOutBtn = document.getElementById("navSignOutBtn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", signOut);
  }

  const isLight = document.body.classList.contains("light-mode");
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isLight ? "🌙 Dark" : "☀️ Light";
  }

  const profileModal = document.getElementById("profileModal");
  const profileBtn = document.getElementById("profileBtn");
  const profileCloseBtn = document.getElementById("profileCloseBtn");
  const profilePicInput = document.getElementById("profilePicInput");
  const changePasswordForm = document.getElementById("changePasswordForm");

  if (profileBtn) {
    profileBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openProfileModal();
    });
  }

  if (profileCloseBtn) {
    profileCloseBtn.addEventListener("click", closeProfileModal);
  }

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
    profilePicInput.addEventListener("change", handleProfilePicUpload);
  }

  if (changePasswordForm) {
    changePasswordForm.addEventListener("submit", handlePasswordChange);
  }
});
