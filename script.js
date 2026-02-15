// script.js

const API_BASE = "https://aihorde.net/api/v2";
const ANON_API_KEY = "0000000000"; // Anonymous key for AI Horde

const promptInput = document.getElementById("prompt");
const generateBtn = document.getElementById("generateBtn");
const loading = document.getElementById("loading");
const errorDiv = document.getElementById("error");
const imageGallery = document.getElementById("imageGallery");
const historyList = document.getElementById("history");
const themeToggle = document.getElementById("themeToggle");

let promptHistory = JSON.parse(localStorage.getItem("promptHistory")) || [];
let generatedImages = JSON.parse(localStorage.getItem("generatedImages")) || [];

// Load history and images from local storage
function loadHistory() {
  historyList.innerHTML = "";
  promptHistory.forEach((prompt, index) => {
    const li = document.createElement("li");
    li.classList.add("list-group-item", "history-item");
    li.textContent = prompt;
    li.addEventListener("click", () => {
      promptInput.value = prompt;
      generateImage(prompt);
    });
    historyList.appendChild(li);
  });
}

function loadImages() {
  imageGallery.innerHTML = "";
  generatedImages.forEach((imgSrc, index) => {
    addImageToGallery(imgSrc);
  });
}

function addImageToGallery(imgSrc) {
  const col = document.createElement("div");
  col.classList.add("col-md-6", "mb-3");
  const card = document.createElement("div");
  card.classList.add("card");
  const img = document.createElement("img");
  img.src = imgSrc;
  img.classList.add("card-img-top");
  const cardBody = document.createElement("div");
  cardBody.classList.add("card-body");
  const downloadBtn = document.createElement("a");
  downloadBtn.href = imgSrc;
  downloadBtn.download = "generated-image.png";
  downloadBtn.classList.add("btn", "btn-success", "w-100");
  downloadBtn.textContent = "Download";
  cardBody.appendChild(downloadBtn);
  card.appendChild(img);
  card.appendChild(cardBody);
  col.appendChild(card);
  imageGallery.appendChild(col);
}

async function generateImage(prompt) {
  if (!prompt) {
    showError("Please enter a prompt");
    return;
  }

  console.log("[DEBUG] Starting image generation with prompt:", prompt);
  showLoading(true);
  errorDiv.classList.add("d-none");

  try {
    // Submit generation request
    console.log("[DEBUG] Submitting request to:", `${API_BASE}/generate/async`);
    const submitResponse = await fetch(`${API_BASE}/generate/async`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_API_KEY,
      },
      body: JSON.stringify({
        prompt: prompt,
        params: {
          sampler_name: "k_euler_a",
          cfg_scale: 7.5,
          denoising_strength: 1.0,
          seed: Math.floor(Math.random() * 1000000).toString(),
          height: 512,
          width: 512,
          seed_variation: 1,
          steps: 20,
          n: 1, // Number of images, can be more for multiple
        },
        models: ["stable_diffusion"], // Can specify other models
        nsfw: true, // Allow NSFW if needed
        censor_nsfw: false,
        r2: true, // Use R2 for direct download links
      }),
    });

    console.log("[DEBUG] Submit response status:", submitResponse.status);
    console.log(
      "[DEBUG] Submit response statusText:",
      submitResponse.statusText,
    );

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error("[DEBUG] Submit error response:", errorText);
      throw new Error(
        `Submit error: ${submitResponse.statusText} - ${errorText}`,
      );
    }

    const submitData = await submitResponse.json();
    console.log("[DEBUG] Submit response data:", submitData);

    const { id } = submitData;
    console.log("[DEBUG] Generation ID:", id);

    // Poll for status - use API's wait_time for optimal polling
    let statusData = null;
    let attempts = 0;
    const maxAttempts = 30;

    // Wait 5 seconds before first check (most images take 5-10s to generate)
    console.log("[DEBUG] Waiting 5 seconds before first check...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    while (attempts < maxAttempts) {
      console.log(
        `[DEBUG] Polling status (attempt ${attempts + 1}/${maxAttempts})`,
      );
      const statusResponse = await fetch(`${API_BASE}/generate/status/${id}`);
      console.log("[DEBUG] Status response status:", statusResponse.status);

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error("[DEBUG] Status error response:", errorText);
        throw new Error(
          `Status error: ${statusResponse.statusText} - ${errorText}`,
        );
      }

      statusData = await statusResponse.json();
      console.log("[DEBUG] Status response:", statusData);

      if (statusData.done) {
        console.log("[DEBUG] Generation completed!");
        break;
      }

      // Use the wait_time from API if available (it's in milliseconds), default to 3 seconds
      const waitTime = statusData.wait_time || 3000;
      console.log(
        `[DEBUG] Generation in progress, waiting ${waitTime / 1000} seconds...`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error("Generation timeout");
    }

    console.log("[DEBUG] Final status:", statusData);

    const generations = statusData.generations || [];
    console.log("[DEBUG] Generations array:", generations);

    if (generations.length === 0) {
      // Check if there's an error in the response
      if (statusData.faulted) {
        console.error("[DEBUG] Generation faulted:", statusData);
        throw new Error(statusData.error || "Generation failed on server");
      }
      throw new Error("No images generated");
    }

    // Display images
    imageGallery.innerHTML = "";
    generations.forEach((gen) => {
      console.log("[DEBUG] Processing generation:", gen);
      const imgSrc = gen.img;
      console.log("[DEBUG] Image source:", imgSrc);
      addImageToGallery(imgSrc);
      generatedImages.push(imgSrc);
    });

    // Update history
    if (!promptHistory.includes(prompt)) {
      promptHistory.push(prompt);
    }
    localStorage.setItem("promptHistory", JSON.stringify(promptHistory));
    localStorage.setItem("generatedImages", JSON.stringify(generatedImages));
    loadHistory();
  } catch (error) {
    showError(error.message);
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  loading.classList.toggle("d-none", !show);
  generateBtn.disabled = show;
}

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove("d-none");
}

// Theme toggle
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem(
    "darkMode",
    document.body.classList.contains("dark-mode"),
  );
});

// Load theme
if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark-mode");
}

// Event listeners
generateBtn.addEventListener("click", () => {
  const prompt = promptInput.value.trim();
  generateImage(prompt);
});

loadHistory();
loadImages();
