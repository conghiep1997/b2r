/**
 * AI Model configurations and definitions.
 */
(function (global) {
  const GEMINI_MODELS = [
    {
      value: "gemini-3.1-flash-lite",
      label: "Gemini 3.1 Flash Lite",
      badge: "500 RPD",
      tier: 1,
      default: true,
    },
    {
      value: "gemini-3.5-flash-lite",
      label: "Gemini 3.5 Flash Lite",
      badge: "500 RPD",
      tier: 1,
      default: true,
    },
    {
      value: "gemini-3.5-flash",
      label: "Gemini 3.5 Flash",
      badge: "20 RPD",
      tier: 2,
    },
    {
      value: "gemini-3.8-flash",
      label: "Gemini 3.8 Flash",
      badge: "20 RPD",
      tier: 2,
    },
  ];

  const CEREBRAS_MODELS = [
    { value: "gpt-oss-120b", label: "GPT OSS 120B", default: true },
    {
      value: "qwen-3-235b-a22b-instruct-2507",
      label: "Qwen 3 235B A22B Instruct",
    },
    { value: "zai-glm-4.7", label: "ZAI GLM 4.7" },
  ];

  const OPENROUTER_MODELS = [
    { value: "openrouter/free", label: "OpenRouter Free Router", default: true },
    { value: "qwen/qwen3-coder:free", label: "Qwen3 Coder 480B A35B" },
    { value: "meta-llama/llama-3.2-3b-instruct:free", label: "Llama 3.2 3B Instruct" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
    {
      value: "meta-llama/llama-3.1-70b-instruct",
      label: "Meta Llama 3.1 70B",
    },
    { value: "mistralai/mistral-7b-instruct-v0.3", label: "Mistral 7B Instruct v0.3" },
    { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku" },
  ];

  const GROQ_MODELS = [
    {
      value: "llama-3.3-70b-versatile",
      label: "Llama 3.3 70B Versatile",
      default: true,
    },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
    {
      value: "meta-llama/llama-4-scout-17b-16e-instruct",
      label: "Llama 4 Scout 17B 16E",
    },
    { value: "qwen/qwen3-32b", label: "Qwen 3 32B" },
    { value: "openai/gpt-oss-120b", label: "GPT OSS 120B" },
    { value: "openai/gpt-oss-20b", label: "GPT OSS 20B" },
  ];

  global.TB_PROVIDERS = {
    GEMINI: "gemini",
    CEREBRAS: "cerebras",
    GROQ: "groq",
    OPENROUTER: "openrouter",
    NONE: "none",
  };

  global.TB_MODELS = {
    GEMINI_MODELS,
    CEREBRAS_MODELS,
    GROQ_MODELS,
    OPENROUTER_MODELS,
    GEMINI: "gemini-3.1-flash-lite",
    GEMINI_FALLBACK: "gemini-3.5-flash-lite",
    CEREBRAS: "gpt-oss-120b",
    GROQ: "llama-3.3-70b-versatile",
    OPENROUTER: "openrouter/free",
  };
})(globalThis);
