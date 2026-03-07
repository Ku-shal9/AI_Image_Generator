/**
 * app-dom.js - DOM refs, state, HF config, getHuggingFaceToken
 */

let promptInput;
let generateBtn;
let loadingEl;
let errorEl;
let freshSection;
let freshImg;
let freshPromptText;
let freshModelBadge;
let freshDownloadBtn;
let freshSaveBtn;
let rateLimitFill;
let rateLimitText;
let sidebarHistoryList;
let sidebarEmptyState;
let clearHistoryBtn;

let currentImageData = null;

const HF_MODELS = [
  { id: "black-forest-labs/FLUX.1-schnell", steps: 4 },
  { id: "stabilityai/stable-diffusion-xl-base-1.0", steps: 20 },
  { id: "runwayml/stable-diffusion-v1-5", steps: 20 },
];

const HF_API_BASE = "https://router.huggingface.co/hf-inference/models";

const HF_OWNER_TOKEN = "";

function getHuggingFaceToken() {
  try {
    return localStorage.getItem("pg_hf_token") || "";
  } catch (_) {
    return "";
  }
}
