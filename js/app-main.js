/**
 * app-main.js - Rate UI, sidebar history, UI helpers, generate, fresh image, gallery save, payment wall, profile modal
 */

function updateRateLimitUI() {
  const { used, limit, remaining } = checkRateLimit();

  if (!rateLimitFill || !rateLimitText) return;

  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  rateLimitFill.style.width = pct + "%";

  if (pct >= 100) {
    rateLimitFill.classList.add("exceeded");
  } else {
    rateLimitFill.classList.remove("exceeded");
  }

  rateLimitText.textContent = `${remaining} generation${remaining !== 1 ? "s" : ""} remaining`;

  if (remaining === 0) {
    rateLimitText.style.color = "var(--danger)";
  } else if (remaining <= 2) {
    rateLimitText.style.color = "var(--warning)";
  } else {
    rateLimitText.style.color = "var(--text-secondary)";
  }
}

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
    if (sidebarEmptyState) sidebarEmptyState.classList.remove("d-none");
    return;
  }

  if (sidebarEmptyState) sidebarEmptyState.classList.add("d-none");

  history.forEach(function (entry) {
    const item = document.createElement("div");
    item.className = "history-item";

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

    item.addEventListener("click", function () {
      if (promptInput) {
        promptInput.value = entry.prompt;
        promptInput.focus();
      }
    });

    sidebarHistoryList.appendChild(item);
  });
}

function showLoading() {
  if (loadingEl) loadingEl.classList.remove("d-none");
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.classList.add("generating");
    generateBtn.textContent = "⏳ Generating...";
  }
}

function hideLoading() {
  if (loadingEl) loadingEl.classList.add("d-none");
  if (generateBtn) {
    generateBtn.disabled = false;
    generateBtn.classList.remove("generating");
    generateBtn.textContent = "✦ Generate Image";
  }
}

function showError(message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove("d-none");
}

function hideError() {
  if (errorEl) errorEl.classList.add("d-none");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function generateImage() {
  const prompt = promptInput ? promptInput.value.trim() : "";

  if (!prompt) {
    showError("Please enter a prompt before generating.");
    return;
  }

  if (prompt.length < 3) {
    showError("Prompt is too short. Please be more descriptive.");
    return;
  }

  const rateCheck = checkRateLimit();
  if (!rateCheck.allowed) {
    showError("");
    showPaymentWall();
    return;
  }

  hideError();
  hideFreshSection();
  showLoading();

  console.log("[Photo Galli] Generating image for prompt:", prompt);

  let imgUrl = null;
  let imageSource = "";
  let modelName = "";

  const cleanPrompt = prompt.trim();
  const seed = Math.floor(Math.random() * 1000000);

  /* Netlify functions only run on Netlify (or with `netlify dev`). On localhost they return 405. */
  const isNetlify =
    typeof window !== "undefined" &&
    window.location &&
    !/^localhost$|^127\.0\.0\.1$|^\[::1\]$/i.test(window.location.hostname);

  if (isNetlify) {
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
  } else {
    console.log(
      "[Photo Galli] Local dev: Netlify functions unavailable, using Puter.ai.",
    );
  }

  if (!imgUrl) {
    try {
      console.log("[Photo Galli] Trying Puter.ai (fallback)...");

      if (typeof puter !== "undefined" && puter.ai && puter.ai.txt2img) {
        const puterImg = await Promise.race([
          puter.ai.txt2img(cleanPrompt),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Puter.ai timeout")), 60000),
          ),
        ]);

        if (puterImg && puterImg.src) {
          let puterSrc = puterImg.src;

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

  hideLoading();

  if (!imgUrl) {
    showError(
      "Failed to generate image. Please check your connection and try again.",
    );
    return;
  }

  currentImageData = {
    url: imgUrl,
    prompt: prompt,
    timestamp: Date.now(),
    source: imageSource,
    model: modelName || "AI Model",
  };

  incrementGenerationCount();
  addToPromptHistory(prompt);
  displayFreshImage(currentImageData);
  renderSidebarHistory();
  updateRateLimitUI();

  console.log("[Photo Galli] Image generated successfully from:", imageSource);
}

function displayFreshImage(imgData) {
  if (!freshSection || !freshImg) return;

  freshImg.src = imgData.url;
  freshImg.alt = imgData.prompt;

  if (freshPromptText) {
    freshPromptText.textContent = `"${imgData.prompt}"`;
  }

  if (freshModelBadge && imgData.model) {
    freshModelBadge.textContent = `🤖 Generated with ${imgData.model}`;
    freshModelBadge.style.display = "inline-block";
  }

  if (freshDownloadBtn) {
    freshDownloadBtn.href = imgData.url;
    freshDownloadBtn.download = `photogalli-${Date.now()}.png`;
  }

  freshSection.classList.remove("d-none");
  freshSection.classList.add("visible");

  freshSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideFreshSection() {
  if (!freshSection) return;
  freshSection.classList.add("d-none");
  freshSection.classList.remove("visible");
}

function saveToGallery() {
  if (!currentImageData) {
    showError("No image to save.");
    return;
  }

  addToUserGallery(currentImageData);

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

function showPaymentWall() {
  const paymentWall = document.getElementById("paymentWall");
  if (!paymentWall) return;

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

  const profileUsername = document.getElementById("profileUsername");
  const profileRole = document.getElementById("profileRole");
  const profileImg = document.getElementById("profileImg");
  const profileInitial = document.getElementById("profileInitial");

  if (profileUsername) profileUsername.textContent = user.username;
  if (profileRole) profileRole.textContent = user.role;

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

  updateProfileRateLimit();

  profileModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeProfileModal() {
  const profileModal = document.getElementById("profileModal");
  if (!profileModal) return;
  profileModal.classList.remove("active");
  document.body.style.overflow = "";
}

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

function handleProfilePicUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select an image file.");
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    alert("Image size should be less than 2MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    const base64Image = event.target.result;
    const user = getCurrentUser();

    if (user) {
      saveUserProfilePicture(user.id, base64Image);

      updateNavbarProfile();

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

  if (newPass !== confirmPass) {
    if (passwordChangeMsg) {
      passwordChangeMsg.textContent = "New passwords do not match.";
      passwordChangeMsg.className = "alert-retro alert-retro-danger mt-2";
      passwordChangeMsg.classList.remove("d-none");
    }
    return;
  }

  const result = changeUserPassword(oldPass, newPass);

  if (passwordChangeMsg) {
    passwordChangeMsg.textContent = result.message;
    passwordChangeMsg.className = `alert-retro alert-retro-${result.success ? "success" : "danger"} mt-2`;
    passwordChangeMsg.classList.remove("d-none");
  }

  if (result.success) {
    oldPassword.value = "";
    newPasswordChange.value = "";
    confirmPassword.value = "";
  }
}
