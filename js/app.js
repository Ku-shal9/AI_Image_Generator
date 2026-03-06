/**
 * app.js - Photo Galli Main Application Logic
 * Handles image generation via API, DOM manipulation for the home page,
 * and sidebar prompt history display.
 *
 * Depends on: auth.js (must be loaded first)
 */

// ============================================================
// DOM ELEMENT REFERENCES (initialized in DOMContentLoaded)
// ============================================================

/** Prompt textarea where user types their image description */
let promptInput;

/** Button that triggers image generation */
let generateBtn;

/** Loading spinner container */
let loadingEl;

/** Error message container */
let errorEl;

/** Container shown after a fresh image is generated */
let freshSection;

/** The freshly generated image element */
let freshImg;

/** Prompt text shown below the fresh image */
let freshPromptText;

/** Model badge showing which AI was used */
let freshModelBadge;

/** Download button for the fresh image */
let freshDownloadBtn;

/** Save-to-gallery button for the fresh image */
let freshSaveBtn;

/** Rate limit progress bar fill */
let rateLimitFill;

/** Rate limit text display */
let rateLimitText;

/** Sidebar history list container */
let sidebarHistoryList;

/** Sidebar empty state message */
let sidebarEmptyState;

/** Clear history button in sidebar */
let clearHistoryBtn;

// ============================================================
// STATE
// ============================================================

/** Holds the most recently generated image data */
let currentImageData = null;

/**
 * Hugging Face models tried in order.
 * - FLUX.1-schnell: gated (accept license at huggingface.co/black-forest-labs/FLUX.1-schnell)
 * - SDXL: open, no gating required
 * - SD v1.5: widely available fallback
 * router.huggingface.co supports CORS from browsers.
 */
const HF_MODELS = [
  { id: "black-forest-labs/FLUX.1-schnell", steps: 4 },
  { id: "stabilityai/stable-diffusion-xl-base-1.0", steps: 20 },
  { id: "runwayml/stable-diffusion-v1-5", steps: 20 },
];

/**
 * Hugging Face Inference Router base URL.
 * This endpoint supports CORS from browser origins.
 */
const HF_API_BASE = "https://router.huggingface.co/hf-inference/models";

/**
 * Project-level Hugging Face token.
 * IMPORTANT: This must NEVER be hard-coded in frontend code.
 * It is now read only inside the Netlify Function using an environment variable.
 */
const HF_OWNER_TOKEN = "";

/**
 * Safely reads the user's Hugging Face token from localStorage.
 * The token is stored under the key "pg_hf_token".
 * If no token is found, returns an empty string.
 * @returns {string}
 */
function getHuggingFaceToken() {
  try {
    return localStorage.getItem("pg_hf_token") || "";
  } catch (_) {
    return "";
  }
}

// Guest free limit is defined centrally in auth.js as GUEST_FREE_LIMIT

// ============================================================
// RATE LIMIT UI
// ============================================================

/**
 * Updates the rate limit progress bar and text in the UI.
 * Shows how many generations the user has used vs. their limit.
 */
function updateRateLimitUI() {
  const { used, limit, remaining } = checkRateLimit();

  if (!rateLimitFill || !rateLimitText) return;

  // Calculate percentage used
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  rateLimitFill.style.width = pct + "%";

  // Change color based on usage
  if (pct >= 100) {
    rateLimitFill.classList.add("exceeded");
  } else {
    rateLimitFill.classList.remove("exceeded");
  }

  rateLimitText.textContent = `${remaining} generation${remaining !== 1 ? "s" : ""} remaining`;

  // Color the text based on remaining
  if (remaining === 0) {
    rateLimitText.style.color = "var(--danger)";
  } else if (remaining <= 2) {
    rateLimitText.style.color = "var(--warning)";
  } else {
    rateLimitText.style.color = "var(--text-secondary)";
  }
}

// ============================================================
// SIDEBAR HISTORY
// ============================================================

/**
 * Renders the prompt history in the sidebar.
 * Each item is clickable to re-populate the prompt input.
 */
function renderSidebarHistory(searchQuery = "") {
  if (!sidebarHistoryList) return;

  const allHistory = getUserPromptHistory();
  const query = searchQuery.trim().toLowerCase();
  const history = query
    ? allHistory.filter(function (entry) {
        return entry.prompt.toLowerCase().includes(query);
      })
    : allHistory;
  sidebarHistoryList.innerHTML = "";

  if (history.length === 0) {
    // Show empty state
    if (sidebarEmptyState) sidebarEmptyState.classList.remove("d-none");
    return;
  }

  // Hide empty state
  if (sidebarEmptyState) sidebarEmptyState.classList.add("d-none");

  // Build history items
  history.forEach(function (entry) {
    const item = document.createElement("div");
    item.className = "history-item";

    // Format the date
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    item.innerHTML = `
      <div class="history-prompt">${escapeHtml(entry.prompt)}</div>
      <div class="history-meta">${dateStr}</div>
    `;

    // Click to reuse prompt
    item.addEventListener("click", function () {
      if (promptInput) {
        promptInput.value = entry.prompt;
        promptInput.focus();
      }
    });

    sidebarHistoryList.appendChild(item);
  });
}

// ============================================================
// UI HELPERS
// ============================================================

/**
 * Shows the loading spinner and disables the generate button.
 */
function showLoading() {
  if (loadingEl) loadingEl.classList.remove("d-none");
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.classList.add("generating");
    generateBtn.textContent = "⏳ Generating...";
  }
}

/**
 * Hides the loading spinner and re-enables the generate button.
 */
function hideLoading() {
  if (loadingEl) loadingEl.classList.add("d-none");
  if (generateBtn) {
    generateBtn.disabled = false;
    generateBtn.classList.remove("generating");
    generateBtn.textContent = "✦ Generate Image";
  }
}

/**
 * Displays an error message to the user.
 * @param {string} message - The error text to show
 */
function showError(message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove("d-none");
}

/**
 * Hides the error message.
 */
function hideError() {
  if (errorEl) errorEl.classList.add("d-none");
}

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
 * Formats a timestamp into a readable date string.
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
// IMAGE GENERATION
// ============================================================

/**
 * Main function: generates an AI image from the user's prompt.
 * Uses Pollinations.ai as the primary free API (true real-time AI generation).
 * Falls back to alternative endpoints if the first fails.
 *
 * Flow:
 *  1. Validate input
 *  2. Check rate limit
 *  3. Show loading state
 *  4. Call API with async/await
 *  5. Display result
 *  6. Update history and rate limit
 */
async function generateImage() {
  // --- 1. Get and validate prompt ---
  const prompt = promptInput ? promptInput.value.trim() : "";

  if (!prompt) {
    showError("Please enter a prompt before generating.");
    return;
  }

  if (prompt.length < 3) {
    showError("Prompt is too short. Please be more descriptive.");
    return;
  }

  // --- 2. Check rate limit ---
  const rateCheck = checkRateLimit();
  if (!rateCheck.allowed) {
    showError("");
    showPaymentWall();
    return;
  }

  // --- 3. Show loading ---
  hideError();
  hideFreshSection();
  showLoading();

  console.log("[Photo Galli] Generating image for prompt:", prompt);

  // --- 4. Call API ---
  let imgUrl = null;
  let imageSource = "";
  let modelName = "";

  // Clean the prompt for the URL
  const cleanPrompt = prompt.trim();

  // Generate a random seed for unique image generation
  const seed = Math.floor(Math.random() * 1000000);

  // ============================================================
  // SERVICE 0: Hugging Face via Netlify Function (PRIMARY)
  // The real HF token is stored as an environment variable in Netlify
  // and never exposed to the browser or GitHub.
  // ============================================================
  try {
    console.log("[Photo Galli] Calling Netlify HF function...");
    const res = await fetch("/.netlify/functions/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: cleanPrompt,
        seed: seed,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.imageBase64) {
        imgUrl = "data:image/png;base64," + data.imageBase64;
        imageSource = "Hugging Face";
        modelName = data.model || "HF Model";
        console.log(
          `[Photo Galli] Success with Hugging Face via Netlify (${modelName})!`,
        );
      }
    } else {
      const text = await res.text();
      console.warn(
        "[Photo Galli] Netlify HF function error:",
        res.status,
        text,
      );
    }
  } catch (err) {
    console.warn(
      "[Photo Galli] Netlify HF function failed:",
      err && err.message ? err.message : err,
    );
  }

  // ============================================================
  // SERVICE 1: Puter.js (Fallback)
  // Uses puter.ai.txt2img() - provides real AI-generated images
  // Puter.js must be loaded via <script src="https://js.puter.com/v2/"></script>
  // ============================================================
  if (!imgUrl) {
    try {
      console.log("[Photo Galli] Trying Puter.ai (fallback)...");

      // Check if puter is available (loaded from CDN)
      if (typeof puter !== "undefined" && puter.ai && puter.ai.txt2img) {
        // puter.ai.txt2img returns an HTMLImageElement with the generated image
        const puterImg = await Promise.race([
          puter.ai.txt2img(cleanPrompt),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Puter.ai timeout")), 60000),
          ),
        ]);

        if (puterImg && puterImg.src) {
          let puterSrc = puterImg.src;

          // If Puter gives us a blob: URL, convert it to a reusable data URL
          if (puterSrc.startsWith("blob:")) {
            try {
              const resp = await fetch(puterSrc);
              const blob = await resp.blob();
              const reader = new FileReader();
              puterSrc = await new Promise(function (resolve, reject) {
                reader.onloadend = function () {
                  resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            } catch (e) {
              console.warn(
                "[Photo Galli] Could not convert Puter blob to data URL:",
                e.message,
              );
            }
          }

          imgUrl = puterSrc;
          imageSource = "Puter.ai";
          modelName = "Puter AI";
          console.log("[Photo Galli] Success with Puter.ai!");
        }
      } else {
        console.warn(
          "[Photo Galli] Puter.js not loaded or txt2img unavailable.",
        );
      }
    } catch (err) {
      console.warn("[Photo Galli] Puter.ai failed:", err.message);
    }
  }

  // --- 5. Handle result ---
  hideLoading();

  if (!imgUrl) {
    showError(
      "Failed to generate image. Please check your connection and try again.",
    );
    return;
  }

  // Build image data object with model info
  currentImageData = {
    url: imgUrl,
    prompt: prompt,
    timestamp: Date.now(),
    source: imageSource,
    model: modelName || "AI Model",
  };

  // Increment generation count
  incrementGenerationCount();

  // Add prompt to history
  addToPromptHistory(prompt);

  // Display the fresh image
  displayFreshImage(currentImageData);

  // Update sidebar history
  renderSidebarHistory();

  // Update rate limit UI
  updateRateLimitUI();

  console.log("[Photo Galli] Image generated successfully from:", imageSource);
}

// ============================================================
// FRESH IMAGE DISPLAY
// ============================================================

/**
 * Displays the freshly generated image in the result section.
 * @param {Object} imgData - { url, prompt, timestamp, source, model }
 */
function displayFreshImage(imgData) {
  if (!freshSection || !freshImg) return;

  // Set image source
  freshImg.src = imgData.url;
  freshImg.alt = imgData.prompt;

  // Set prompt text
  if (freshPromptText) {
    freshPromptText.textContent = `"${imgData.prompt}"`;
  }

  // Show model badge
  if (freshModelBadge && imgData.model) {
    freshModelBadge.textContent = `🤖 Generated with ${imgData.model}`;
    freshModelBadge.style.display = "inline-block";
  }

  // Set download link
  if (freshDownloadBtn) {
    freshDownloadBtn.href = imgData.url;
    freshDownloadBtn.download = `photogalli-${Date.now()}.png`;
  }

  // Show the section
  freshSection.classList.remove("d-none");
  freshSection.classList.add("visible");

  // Scroll to the result
  freshSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * Hides the fresh image section.
 */
function hideFreshSection() {
  if (!freshSection) return;
  freshSection.classList.add("d-none");
  freshSection.classList.remove("visible");
}

// ============================================================
// SAVE TO GALLERY
// ============================================================

/**
 * Saves the current fresh image to the user's gallery.
 */
function saveToGallery() {
  if (!currentImageData) {
    showError("No image to save.");
    return;
  }

  addToUserGallery(currentImageData);

  // Visual feedback
  if (freshSaveBtn) {
    freshSaveBtn.textContent = "✓ Saved!";
    freshSaveBtn.disabled = true;
    setTimeout(function () {
      freshSaveBtn.textContent = "💾 Save to Gallery";
      freshSaveBtn.disabled = false;
    }, 2000);
  }

  console.log("[Photo Galli] Image saved to gallery.");
}

// ============================================================
// PAYMENT WALL
// ============================================================

/**
 * Shows the payment wall when the user has exceeded their rate limit.
 * For guests: prompts to sign up or upgrade.
 * For registered users: redirects to pricing page.
 */
function showPaymentWall() {
  const paymentWall = document.getElementById("paymentWall");
  if (!paymentWall) return;

  // Update payment wall content based on user type
  const rateCheck = checkRateLimit();
  const wallTitle = paymentWall.querySelector(".payment-wall-title");
  const wallText = paymentWall.querySelector(".payment-wall-text");
  const wallBtn = paymentWall.querySelector(".btn-retro");

  if (rateCheck.isGuest) {
    if (wallTitle) wallTitle.textContent = "⚠ GUEST LIMIT REACHED";
    if (wallText)
      wallText.innerHTML = `You've used all <strong>${GUEST_FREE_LIMIT} free guest generations</strong>.<br/>Create a free account or upgrade to continue.`;
    if (wallBtn) {
      wallBtn.textContent = "🚀 Sign Up / Upgrade";
      wallBtn.onclick = function () {
        window.location.href = "html/pricing.html";
      };
    }
  } else {
    if (wallTitle) wallTitle.textContent = "⚠ LIMIT REACHED";
    if (wallText)
      wallText.innerHTML = `You've used all your generations for this plan.<br/>Upgrade to continue generating images.`;
    if (wallBtn) {
      wallBtn.textContent = "💳 View Plans";
      wallBtn.onclick = function () {
        window.location.href = "html/pricing.html";
      };
    }
  }

  paymentWall.classList.remove("d-none");
  paymentWall.scrollIntoView({ behavior: "smooth" });
}

// ============================================================
// EVENT LISTENERS (attached in DOMContentLoaded)
// ============================================================

// ============================================================
// PROFILE MODAL FUNCTIONS
// ============================================================

/**
 * Opens the profile modal and populates user data.
 */
function openProfileModal() {
  const profileModal = document.getElementById("profileModal");
  if (!profileModal) {
    console.error("[Photo Galli] Profile modal not found");
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    console.error("[Photo Galli] No user logged in");
    return;
  }

  console.log("[Photo Galli] Opening profile modal for", user.username);

  // Populate user info
  const profileUsername = document.getElementById("profileUsername");
  const profileRole = document.getElementById("profileRole");
  const profileImg = document.getElementById("profileImg");
  const profileInitial = document.getElementById("profileInitial");

  if (profileUsername) profileUsername.textContent = user.username;
  if (profileRole) profileRole.textContent = user.role;

  // Load and display profile picture
  const profilePic = getUserProfilePicture(user.id);
  if (profilePic && profileImg && profileInitial) {
    profileImg.src = profilePic;
    profileImg.style.display = "block";
    profileInitial.style.display = "none";
  } else if (profileImg && profileInitial) {
    profileImg.style.display = "none";
    profileInitial.textContent = user.username.charAt(0).toUpperCase();
    profileInitial.style.display = "flex";
  }

  // Update rate limit display
  updateProfileRateLimit();

  // Show modal
  profileModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

/**
 * Closes the profile modal.
 */
function closeProfileModal() {
  const profileModal = document.getElementById("profileModal");
  if (!profileModal) return;
  profileModal.classList.remove("active");
  document.body.style.overflow = "";
}

/**
 * Updates the rate limit display in the profile modal.
 */
function updateProfileRateLimit() {
  const { used, limit, remaining } = checkRateLimit();

  const profileRateUsed = document.getElementById("profileRateUsed");
  const profileRateLimit = document.getElementById("profileRateLimit");
  const profileRateFill = document.getElementById("profileRateFill");

  if (profileRateUsed) profileRateUsed.textContent = used;
  if (profileRateLimit) profileRateLimit.textContent = limit;

  if (profileRateFill) {
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    profileRateFill.style.width = pct + "%";

    if (pct >= 100) {
      profileRateFill.classList.add("exceeded");
    } else {
      profileRateFill.classList.remove("exceeded");
    }
  }
}

/**
 * Handles profile picture upload.
 * @param {Event} e
 */
function handleProfilePicUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith("image/")) {
    alert("Please select an image file.");
    return;
  }

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    alert("Image size should be less than 2MB.");
    return;
  }

  // Convert to base64
  const reader = new FileReader();
  reader.onload = function (event) {
    const base64Image = event.target.result;
    const user = getCurrentUser();

    if (user) {
      saveUserProfilePicture(user.id, base64Image);

      // Update displays
      updateNavbarProfile();

      // Update profile modal if open
      const profileImg = document.getElementById("profileImg");
      const profileInitial = document.getElementById("profileInitial");
      if (profileImg && profileInitial) {
        profileImg.src = base64Image;
        profileImg.style.display = "block";
        profileInitial.style.display = "none";
      }
    }
  };
  reader.readAsDataURL(file);
}

/**
 * Handles password change form submission.
 * @param {Event} e
 */
function handlePasswordChange(e) {
  e.preventDefault();

  const oldPassword = document.getElementById("oldPassword");
  const newPasswordChange = document.getElementById("newPasswordChange");
  const confirmPassword = document.getElementById("confirmPassword");
  const passwordChangeMsg = document.getElementById("passwordChangeMsg");

  if (!oldPassword || !newPasswordChange || !confirmPassword) return;

  const oldPass = oldPassword.value;
  const newPass = newPasswordChange.value;
  const confirmPass = confirmPassword.value;

  // Validate passwords match
  if (newPass !== confirmPass) {
    if (passwordChangeMsg) {
      passwordChangeMsg.textContent = "New passwords do not match.";
      passwordChangeMsg.className = "alert-retro alert-retro-danger mt-2";
      passwordChangeMsg.classList.remove("d-none");
    }
    return;
  }

  // Change password
  const result = changeUserPassword(oldPass, newPass);

  if (passwordChangeMsg) {
    passwordChangeMsg.textContent = result.message;
    passwordChangeMsg.className = `alert-retro alert-retro-${result.success ? "success" : "danger"} mt-2`;
    passwordChangeMsg.classList.remove("d-none");
  }

  if (result.success) {
    // Clear form
    oldPassword.value = "";
    newPasswordChange.value = "";
    confirmPassword.value = "";
  }
}

// ============================================================
// INITIALIZE HOME PAGE
// ============================================================

console.log("[DEBUG] Setting up DOMContentLoaded listener");

/**
 * Initializes the home page:
 * - Checks authentication
 * - Loads theme
 * - Renders sidebar history
 * - Updates rate limit UI
 * - Updates navbar with user info
 * - Sets up profile modal event listeners
 */
document.addEventListener("DOMContentLoaded", function () {
  console.log("[DEBUG] DOMContentLoaded fired - initializing DOM elements");

  // Initialize DOM element references now that DOM is ready
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

  console.log("[DEBUG] promptInput initialized:", promptInput);

  // Guard: must be logged in (or guest) to access home page
  requireAuth();

  // Apply saved theme
  loadTheme();

  // Update navbar — handle guest mode
  if (isGuest()) {
    // For guests: show "Sign Up" button instead of profile
    const navSignOutBtn = document.getElementById("navSignOutBtn");
    const profileBtn = document.getElementById("profileBtn");
    if (navSignOutBtn) {
      navSignOutBtn.textContent = "🚀 Sign Up";
      navSignOutBtn.onclick = function () {
        window.location.href = "html/signin.html";
      };
    }
    if (profileBtn) profileBtn.style.display = "none";

    // Show guest badge in navbar
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

  // Render sidebar history
  renderSidebarHistory();

  // History search
  const historySearchInput = document.getElementById("historySearchInput");
  if (historySearchInput) {
    historySearchInput.addEventListener("input", function (e) {
      renderSidebarHistory(e.target.value || "");
    });
  }

  // Update rate limit display
  updateRateLimitUI();

  // Attach event listeners now that DOM elements are initialized
  console.log("[DEBUG] Attaching event listeners - generateBtn:", generateBtn);

  // Generate button click
  if (generateBtn) {
    generateBtn.addEventListener("click", generateImage);
  }

  // Allow pressing Enter in the textarea with Ctrl/Cmd to generate
  if (promptInput) {
    promptInput.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        generateImage();
      }
    });
  }

  // Save to gallery button
  if (freshSaveBtn) {
    freshSaveBtn.addEventListener("click", saveToGallery);
  }

  // Clear history button in sidebar
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", function () {
      if (confirm("Clear all prompt history?")) {
        clearPromptHistory();
        renderSidebarHistory();
      }
    });
  }

  // Theme toggle button
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme);
  }

  // Sign out button
  const signOutBtn = document.getElementById("navSignOutBtn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", signOut);
  }

  // Update theme button text
  const isLight = document.body.classList.contains("light-mode");
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isLight ? "🌙 Dark" : "☀️ Light";
  }

  // ==========================================================
  // PROFILE MODAL EVENT LISTENERS (setup after DOM is ready)
  // ==========================================================

  // Get profile elements after DOM is loaded
  const profileModal = document.getElementById("profileModal");
  const profileBtn = document.getElementById("profileBtn");
  const profileCloseBtn = document.getElementById("profileCloseBtn");
  const profilePicInput = document.getElementById("profilePicInput");
  const changePasswordForm = document.getElementById("changePasswordForm");

  // Profile button click - open modal
  if (profileBtn) {
    profileBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openProfileModal();
    });
    console.log("[Photo Galli] Profile button listener attached");
  } else {
    console.warn("[Photo Galli] Profile button not found");
  }

  // Close profile modal
  if (profileCloseBtn) {
    profileCloseBtn.addEventListener("click", closeProfileModal);
  }

  // Close on overlay click
  if (profileModal) {
    profileModal.addEventListener("click", function (e) {
      if (e.target === profileModal) closeProfileModal();
    });
  }

  // Close on Escape key
  document.addEventListener("keydown", function (e) {
    if (
      e.key === "Escape" &&
      profileModal &&
      profileModal.classList.contains("active")
    ) {
      closeProfileModal();
    }
  });

  // Profile picture upload
  if (profilePicInput) {
    profilePicInput.addEventListener("change", handleProfilePicUpload);
  }

  // Password change form
  if (changePasswordForm) {
    changePasswordForm.addEventListener("submit", handlePasswordChange);
  }

  console.log("[Photo Galli] Home page initialized.");
});
