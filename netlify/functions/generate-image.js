// Netlify Function: Proxy to Hugging Face Inference API
// Keeps the HF token on the server side only.

const HF_MODELS = [
  { id: "black-forest-labs/FLUX.1-schnell", steps: 4 },
  { id: "stabilityai/stable-diffusion-xl-base-1.0", steps: 20 },
  { id: "runwayml/stable-diffusion-v1-5", steps: 20 },
];

const HF_API_BASE = "https://router.huggingface.co/hf-inference/models";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    const { prompt, seed } = JSON.parse(event.body || "{}");

    if (!prompt || typeof prompt !== "string") {
      return {
        statusCode: 400,
        body: "Missing or invalid prompt",
      };
    }

    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      return {
        statusCode: 500,
        body: "HF token not configured on server",
      };
    }

    const cleanPrompt = prompt.trim();
    const effectiveSeed =
      typeof seed === "number" && Number.isFinite(seed)
        ? seed
        : Math.floor(Math.random() * 1000000);

    // Try models in order until one succeeds
    for (const modelEntry of HF_MODELS) {
      const hfModel = modelEntry.id;
      const hfSteps = modelEntry.steps;
      const shortName = hfModel.split("/").pop();

      try {
        const res = await fetch(`${HF_API_BASE}/${hfModel}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: cleanPrompt,
            parameters: {
              width: 1024,
              height: 1024,
              num_inference_steps: hfSteps,
              seed: effectiveSeed,
            },
          }),
        });

        if (res.status === 503) {
          // Model loading / cold start – try next model
          continue;
        }

        if (!res.ok) {
          // For 4xx/5xx other than 503, also try next model
          continue;
        }

        const arrayBuffer = await res.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          continue;
        }

        const base64 = Buffer.from(arrayBuffer).toString("base64");

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageBase64: base64,
            model: shortName,
          }),
        };
      } catch (err) {
        // Try next model on network / other error
        // eslint-disable-next-line no-console
        console.error(
          "[Netlify HF] Error with model",
          modelEntry.id,
          err && err.message ? err.message : err,
        );
      }
    }

    // If we reach here, all models failed
    return {
      statusCode: 502,
      body: "All Hugging Face models failed",
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Netlify HF] Handler error", err);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

