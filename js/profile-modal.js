/**
 * Profile modal functionality.
 * Handles opening/closing the modal, profile picture upload,
 * and password change form submission.
 */
document.addEventListener("DOMContentLoaded", function () {
  // Profile button click handler
  const profileBtn = document.getElementById("profileBtn");
  const profileModal = document.getElementById("profileModal");
  const profileCloseBtn = document.getElementById("profileCloseBtn");

  if (profileBtn && profileModal) {
    profileBtn.addEventListener("click", function () {
      profileModal.classList.add("active");
      document.body.style.overflow = "hidden";
    });
  }

  // Close button handler
  if (profileCloseBtn && profileModal) {
    profileCloseBtn.addEventListener("click", function () {
      profileModal.classList.remove("active");
      document.body.style.overflow = "";
    });
  }

  // Close modal when clicking outside
  if (profileModal) {
    profileModal.addEventListener("click", function (e) {
      if (e.target === profileModal) {
        profileModal.classList.remove("active");
        document.body.style.overflow = "";
      }
    });
  }

  // Load profile picture on page load
  loadProfilePicture();

  // Profile picture upload
  const profilePicInput = document.getElementById("profilePicInput");
  const profileImg = document.getElementById("profileImg");
  const profileInitial = document.getElementById("profileInitial");
  const navProfileImg = document.getElementById("navProfileImg");
  const navProfileInitial = document.getElementById("navProfileInitial");

  if (profilePicInput) {
    profilePicInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = function (ev) {
          const imgData = ev.target.result;

          // Save per-user profile picture
          const user = getCurrentUser();
          if (user) {
            saveUserProfilePicture(user.id, imgData);
          }

          // Update modal profile picture
          if (profileImg) {
            profileImg.src = imgData;
            profileImg.style.display = "block";
          }
          if (profileInitial) {
            profileInitial.style.display = "none";
          }

          // Update navbar profile picture
          if (navProfileImg) {
            navProfileImg.src = imgData;
            navProfileImg.style.display = "block";
          }
          if (navProfileInitial) {
            navProfileInitial.style.display = "none";
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Update profile info
  updateProfileInfo();
});

/**
 * Loads profile picture from localStorage and displays it.
 */
function loadProfilePicture() {
  const user = getCurrentUser();
  if (!user) return;

  const navProfileImg = document.getElementById("navProfileImg");
  const navProfileInitial = document.getElementById("navProfileInitial");
  const storedProfilePic = getUserProfilePicture(user.id);

  if (storedProfilePic && navProfileImg) {
    navProfileImg.src = storedProfilePic;
    navProfileImg.style.display = "block";
    if (navProfileInitial) navProfileInitial.style.display = "none";
  } else if (navProfileInitial) {
    const initial = user.username ? user.username.charAt(0).toUpperCase() : "?";
    navProfileInitial.textContent = initial;
    navProfileInitial.style.display = "flex";
    if (navProfileImg) navProfileImg.style.display = "none";
  }
}

/**
 * Updates the profile modal with current user information.
 */
function updateProfileInfo() {
  const user = getCurrentUser();
  if (!user) return;

  const profileUsername = document.getElementById("profileUsername");
  const profileRole = document.getElementById("profileRole");
  const profileEmail = document.getElementById("profileEmail");
  const profileRateUsed = document.getElementById("profileRateUsed");
  const profileRateLimit = document.getElementById("profileRateLimit");
  const profileRateFill = document.getElementById("profileRateFill");

  if (profileUsername) profileUsername.textContent = user.username;
  if (profileRole) profileRole.textContent = user.role.toUpperCase();
  if (profileEmail) profileEmail.textContent = user.email || "Not set";

  const used = user.generationsUsed || 0;
  const limit = user.rateLimit || 6;
  if (profileRateUsed) profileRateUsed.textContent = used;
  if (profileRateLimit) profileRateLimit.textContent = limit;
  if (profileRateFill) {
    const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
    profileRateFill.style.width = pct + "%";
    if (pct >= 100) profileRateFill.classList.add("exceeded");
    else profileRateFill.classList.remove("exceeded");
  }

  const profileImg = document.getElementById("profileImg");
  const profileInitial = document.getElementById("profileInitial");
  const storedProfilePic = getUserProfilePicture(user.id);
  if (storedProfilePic && profileImg) {
    profileImg.src = storedProfilePic;
    profileImg.style.display = "block";
    if (profileInitial) profileInitial.style.display = "none";
  } else if (profileInitial) {
    profileInitial.textContent = user.username
      ? user.username.charAt(0).toUpperCase()
      : "?";
    profileInitial.style.display = "flex";
    if (profileImg) profileImg.style.display = "none";
  }
}

// ---- Username edit ----
document.addEventListener("DOMContentLoaded", function () {
  const editUsernameBtn = document.getElementById("editUsernameBtn");
  const editUsernameForm = document.getElementById("editUsernameForm");
  const saveUsernameBtn = document.getElementById("saveUsernameBtn");
  const cancelUsernameBtn = document.getElementById("cancelUsernameBtn");
  const newUsernameInput = document.getElementById("newUsernameInput");
  const usernameChangeMsg = document.getElementById("usernameChangeMsg");

  if (editUsernameBtn) {
    editUsernameBtn.addEventListener("click", function () {
      const user = getCurrentUser();
      if (newUsernameInput) newUsernameInput.value = user ? user.username : "";
      editUsernameForm.classList.remove("d-none");
      editUsernameBtn.classList.add("d-none");
    });
  }
  if (cancelUsernameBtn) {
    cancelUsernameBtn.addEventListener("click", function () {
      editUsernameForm.classList.add("d-none");
      editUsernameBtn.classList.remove("d-none");
      usernameChangeMsg.classList.add("d-none");
    });
  }
  if (saveUsernameBtn) {
    saveUsernameBtn.addEventListener("click", function () {
      const val = newUsernameInput ? newUsernameInput.value : "";
      const result = changeUsername(val);
      usernameChangeMsg.className = result.success
        ? "alert-retro alert-retro-success mt-2"
        : "alert-retro alert-retro-danger mt-2";
      usernameChangeMsg.textContent = result.message;
      usernameChangeMsg.classList.remove("d-none");
      if (result.success) {
        updateProfileInfo();
        loadProfilePicture();
        setTimeout(function () {
          editUsernameForm.classList.add("d-none");
          editUsernameBtn.classList.remove("d-none");
          usernameChangeMsg.classList.add("d-none");
        }, 1500);
      }
    });
  }

  // ---- Email edit ----
  const editEmailBtn = document.getElementById("editEmailBtn");
  const editEmailForm = document.getElementById("editEmailForm");
  const saveEmailBtn = document.getElementById("saveEmailBtn");
  const cancelEmailBtn = document.getElementById("cancelEmailBtn");
  const newEmailInput = document.getElementById("newEmailInput");
  const emailChangeMsg = document.getElementById("emailChangeMsg");

  if (editEmailBtn) {
    editEmailBtn.addEventListener("click", function () {
      const user = getCurrentUser();
      if (newEmailInput)
        newEmailInput.value = user && user.email ? user.email : "";
      editEmailForm.classList.remove("d-none");
      editEmailBtn.classList.add("d-none");
    });
  }
  if (cancelEmailBtn) {
    cancelEmailBtn.addEventListener("click", function () {
      editEmailForm.classList.add("d-none");
      editEmailBtn.classList.remove("d-none");
      emailChangeMsg.classList.add("d-none");
    });
  }
  if (saveEmailBtn) {
    saveEmailBtn.addEventListener("click", function () {
      const user = getCurrentUser();
      if (!user) return;
      const val = newEmailInput ? newEmailInput.value : "";
      const result = updateUserEmail(user.id, val);
      emailChangeMsg.className = result.success
        ? "alert-retro alert-retro-success mt-2"
        : "alert-retro alert-retro-danger mt-2";
      emailChangeMsg.textContent = result.message;
      emailChangeMsg.classList.remove("d-none");
      if (result.success) {
        updateProfileInfo();
        setTimeout(function () {
          editEmailForm.classList.add("d-none");
          editEmailBtn.classList.remove("d-none");
          emailChangeMsg.classList.add("d-none");
        }, 1500);
      }
    });
  }
});
