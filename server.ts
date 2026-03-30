import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let base = process.env.OLLAMA_API_URL || "http://phantomx.zapto.org";

// If the user provided a full path, use it as is. 
// Otherwise, append /api/generate
const OLLAMA_BASE_URL = (process.env.OLLAMA_API_URL || "http://phantomx.zapto.org").replace(/\/api\/generate$/, "").replace(/\/api$/, "").replace(/\/$/, "");
const OLLAMA_API_URL = `${OLLAMA_BASE_URL}/api/generate`;
const OLLAMA_TAGS_URL = `${OLLAMA_BASE_URL}/api/tags`;

// Default Profile Templates
const PROFILE_TEMPLATES = {
  'qwen3:1.7b': {
    id: 'fast',
    label: 'Fast',
    description: 'Optimized for Latency',
    system: "You are a fast, concise assistant. Do not use internal reasoning or thinking blocks. Provide direct answers. Do not introduce yourself or use generic AI preambles.",
    options: { num_predict: 2048, temperature: 0.5 }
  },
  'qwen3:4b': {
    id: 'thinking',
    label: 'Think',
    description: 'Optimized for Accuracy',
    system: "You are a thoughtful assistant. Use your internal reasoning process to provide accurate and detailed answers. Do not introduce yourself or use generic AI preambles.",
    options: { temperature: 0.7 }
  },
  'qwen3-phantomx:1.0': {
    id: 'pro',
    label: 'Pro',
    description: 'Infrastructure & Coding',
    system: "You are an expert in infrastructure and coding. Provide technical precision in your answers. Do not introduce yourself or use generic AI preambles. If requested to output structured data, use strictly valid JSON.",
    options: { temperature: 0.2 }
  }
};

const getDynamicProfiles = async () => {
  try {
    const response = await axios.get(OLLAMA_TAGS_URL);
    const models = response.data.models || [];
    
    const dynamicProfiles: any = {};
    
    // Map known models to templates
    models.forEach((m: any) => {
      const modelName = m.name;
      if (PROFILE_TEMPLATES[modelName as keyof typeof PROFILE_TEMPLATES]) {
        const template = PROFILE_TEMPLATES[modelName as keyof typeof PROFILE_TEMPLATES];
        dynamicProfiles[template.id] = { ...template, model: modelName };
      } else {
        // Add unknown models as generic profiles
        const id = modelName.replace(/[:.]/g, '-');
        dynamicProfiles[id] = {
          id,
          label: modelName.split(':')[0],
          model: modelName,
          description: `Model: ${modelName}`,
          system: "",
          options: { temperature: 0.7 }
        };
      }
    });

    // Ensure we have at least one profile
    if (Object.keys(dynamicProfiles).length === 0) {
      return {
        fast: {
          id: 'fast',
          label: 'Fast',
          model: "qwen3:1.7b",
          description: 'Optimized for Latency (Fallback)',
          system: "",
          options: {}
        }
      };
    }

    return dynamicProfiles;
  } catch (error) {
    console.error("[ai.ops] Error fetching dynamic profiles:", error);
    // Return hardcoded defaults as fallback
    return {
      fast: { id: 'fast', label: 'Fast', model: "qwen3:1.7b", description: 'Optimized for Latency', system: "", options: {} },
      thinking: { id: 'thinking', label: 'Think', model: "qwen3:4b", description: 'Optimized for Accuracy', system: "", options: {} },
      pro: { id: 'pro', label: 'Pro', model: "qwen3-phantomx:1.0", description: 'Infrastructure & Coding', system: "", options: {} }
    };
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Get available profiles dynamically
  app.get("/api/profiles", async (req, res) => {
    const profiles = await getDynamicProfiles();
    const profileList = Object.values(profiles).map((p: any) => ({
      id: p.id,
      label: p.label,
      model: p.model,
      description: p.description
    }));
    res.json(profileList);
  });

  // API Proxy for Ollama
  app.post("/api/chat", async (req, res) => {
    const { prompt, stream, history, profile } = req.body;

    const profiles = await getDynamicProfiles();
    const config = profiles[profile] || Object.values(profiles)[0];

    // Construct the full prompt with history for multi-turn
    const systemPrompt = config.system ? `System: ${config.system}\n\n` : "";
    const historyPrompt = history && history.length > 0
      ? history.map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + '\n'
      : "";
    const fullPrompt = `${systemPrompt}${historyPrompt}User: ${prompt}\nAssistant:`;

    try {
      if (stream) {
        const response = await axios({
          method: "post",
          url: OLLAMA_API_URL,
          data: {
            model: config.model,
            prompt: fullPrompt,
            system: config.system,
            stream: true,
            options: config.options,
          },
          responseType: "stream",
          timeout: 300000,
        });

        // Check if the response is HTML (which indicates an error page from a proxy or server)
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
          res.status(500).json({ error: "AI backend returned an HTML error page. Please check the API URL and connectivity." });
          return;
        }

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        let buffer = "";
        response.data.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          
          // Check for HTML in the buffer
          if (buffer.includes("<!DOCTYPE html>") || buffer.includes("<html")) {
            res.write(`data: ${JSON.stringify({ error: "Received HTML content instead of JSON stream." })}\n\n`);
            res.end();
            return;
          }

          const lines = buffer.split("\n");
          // Keep the last partial line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            try {
              const json = JSON.parse(trimmedLine);
              if (json.response) {
                res.write(`data: ${JSON.stringify({ 
                  token: json.response
                })}\n\n`);
              }
              if (json.done) {
                res.write("data: [DONE]\n\n");
                res.end();
              }
            } catch (e) {
              // Only log if it's clearly not a partial chunk we're waiting for
              if (trimmedLine.startsWith("{") && trimmedLine.endsWith("}")) {
                console.error("Failed to parse complete JSON line:", trimmedLine);
              }
            }
          }
        });

        response.data.on("end", () => {
          // Process any remaining data in the buffer
          if (buffer.trim()) {
            try {
              const json = JSON.parse(buffer.trim());
              if (json.response) {
                res.write(`data: ${JSON.stringify({ 
                  token: json.response
                })}\n\n`);
              }
            } catch (e) {
              // Final chunk might still be partial if connection closed unexpectedly
            }
          }
          if (!res.writableEnded) {
            res.write("data: [DONE]\n\n");
            res.end();
          }
        });

        response.data.on("error", (err: any) => {
          console.error("Stream error:", err);
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: "Stream error occurred" })}\n\n`);
            res.end();
          }
        });

      } else {
        const response = await axios.post(OLLAMA_API_URL, {
          model: config.model,
          prompt: fullPrompt,
          system: config.system,
          stream: false,
          options: config.options,
        }, {
          timeout: 300000,
        });

        const data = response.data;
        const cleanResponse = data.response || "";
        
        res.json({ response: cleanResponse });
      }
    } catch (error: any) {
      console.error("Ollama API Error:", error.message);
      res.status(500).json({ error: "Failed to connect to AI model backend." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
