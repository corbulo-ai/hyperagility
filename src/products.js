// Maps exact model names onto the product lines people actually choose between.
// Returns { maker, line }, or null for models with no meaningful product line (fine-tunes, research models).
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function productLine(name) {
  const n = String(name).toLowerCase();
  let m;

  if ((m = n.match(/^(?:claude-(?:[\d.]+-)?)?(opus|sonnet|haiku|fable)\b/))) return { maker: "Anthropic", line: `Claude ${cap(m[1])}` };

  if (n.startsWith("gpt-oss")) return { maker: "OpenAI", line: "GPT-OSS" };
  if ((m = n.match(/^gpt-[\d.]+-(sol|terra|luna|astra)\b/))) return { maker: "OpenAI", line: `GPT ${cap(m[1])}` };
  if (/^(gpt-3\.5|chatgpt$)/.test(n)) return { maker: "OpenAI", line: "GPT-3.5" };
  if ((m = n.match(/^gpt-(4o|4\.1|4\.5|4|5(?:\.\d+)?|6(?:\.\d+)?)(?![\d.])(.*)$/))) {
    const base = m[1].startsWith("5") ? "5" : m[1].startsWith("6") ? "6" : m[1];
    const variant = m[2].match(/-(mini|nano|codex|pro)\b/);
    return { maker: "OpenAI", line: `GPT-${base}${variant ? " " + (variant[1] === "codex" ? "Codex" : variant[1] === "pro" ? "Pro" : variant[1]) : ""}` };
  }
  if ((m = n.match(/^o(\d)(-mini)?(?:-|$)/))) return { maker: "OpenAI", line: `o${m[1]}${m[2] ? " mini" : ""}` };

  if (n.startsWith("gemma")) return { maker: "Google", line: "Gemma" };
  if (n.startsWith("gemini")) {
    if (n.includes("flash-lite")) return { maker: "Google", line: "Gemini Flash-Lite" };
    if (n.includes("flash")) return { maker: "Google", line: "Gemini Flash" };
    if (n.includes("-pro")) return { maker: "Google", line: "Gemini Pro" };
    return null;
  }

  if ((m = n.match(/^kimi-k([\d.]+)(-code|-thinking)?/))) return { maker: "Moonshot", line: `Kimi K${m[1]}${m[2] ? " " + cap(m[2].slice(1)) : ""}` };

  if (n.includes("distill") && n.startsWith("deepseek")) return { maker: "DeepSeek", line: "DeepSeek R1 Distill" };
  if (n.startsWith("deepseek-r1")) return { maker: "DeepSeek", line: "DeepSeek R1" };
  if ((m = n.match(/^deepseek-v4(?:\.\d+)?-(flash|pro)/))) return { maker: "DeepSeek", line: `DeepSeek V4 ${cap(m[1])}` };
  if ((m = n.match(/^deepseek-v(\d)/))) return { maker: "DeepSeek", line: `DeepSeek V${m[1]}` };

  if (n.startsWith("qwen")) {
    if (n.includes("-vl")) return { maker: "Alibaba", line: "Qwen VL" };
    if (n.includes("coder")) return { maker: "Alibaba", line: "Qwen Coder" };
    if ((m = n.match(/-(max|plus|flash)\b/))) return { maker: "Alibaba", line: `Qwen ${cap(m[1])}` };
    if ((m = n.match(/^qwen(\d)/))) return { maker: "Alibaba", line: `Qwen ${m[1]}` };
    return null;
  }

  if ((m = n.match(/^glm-(\d)/))) {
    if (n.includes("flash")) return { maker: "Z.ai", line: "GLM Flash" };
    if (n.includes("air")) return { maker: "Z.ai", line: "GLM Air" };
    return { maker: "Z.ai", line: `GLM ${m[1]}` };
  }

  if (n.startsWith("grok")) {
    if (n.includes("fast")) return { maker: "xAI", line: "Grok Fast" };
    if (n.includes("mini")) return { maker: "xAI", line: "Grok mini" };
    if ((m = n.match(/^grok-(\d)/))) return { maker: "xAI", line: `Grok ${m[1]}` };
  }

  if ((m = n.match(/^llama-([234])(?:\.\d+)?(?:-|$)/))) return { maker: "Meta", line: `Llama ${m[1]}` };
  return null;
}
