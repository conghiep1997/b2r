/**
 * AI Prompts used for translation and extraction.
 * Keep SYSTEM short: every request pays this fixed token cost.
 */
(function (global) {
  const LANGUAGE_NAMES = Object.freeze({
    auto: "tự nhận diện",
    ja: "tiếng Nhật",
    vi: "tiếng Việt",
    en: "tiếng Anh",
    ko: "tiếng Hàn",
    "zh-CN": "tiếng Trung giản thể",
    "zh-TW": "tiếng Trung phồn thể",
    th: "tiếng Thái",
    id: "tiếng Indonesia",
    fr: "tiếng Pháp",
    de: "tiếng Đức",
    es: "tiếng Tây Ban Nha",
    pt: "tiếng Bồ Đào Nha",
  });

  function resolveLanguagePair(settings = {}) {
    const source = Object.hasOwn(LANGUAGE_NAMES, settings.translationSourceLanguage)
      ? settings.translationSourceLanguage
      : "ja";
    const selectedTarget = settings.translationTargetLanguage;
    const target =
      selectedTarget !== "auto" && Object.hasOwn(LANGUAGE_NAMES, selectedTarget)
        ? selectedTarget
        : "vi";
    return { source, target };
  }

  function translationPrompt(text, settings) {
    const { source, target } = resolveLanguagePair(settings);
    const sourceInstruction =
      source === "auto"
        ? "Tự nhận diện ngôn ngữ nguồn của từng đoạn."
        : source === "ja" && target === "vi"
          ? "Ngôn ngữ nguồn chính: tiếng Nhật. Nếu toàn bộ nội dung bằng tiếng Anh hoặc có đoạn tiếng Anh xen kẽ, cũng dịch sang tiếng Việt."
          : `Ngôn ngữ nguồn chính: ${LANGUAGE_NAMES[source]}. Dịch cả các đoạn ngôn ngữ khác xen kẽ nếu cần.`;
    return `Dịch toàn bộ nội dung sang ${LANGUAGE_NAMES[target]}. ${sourceInstruction}
[BẮT ĐẦU]
${text}
[KẾT THÚC]`;
  }

  const supportedLanguages = new Set(Object.keys(LANGUAGE_NAMES));
  const ENGLISH_LANGUAGE_NAMES = Object.freeze({
    auto: "the detected language",
    ja: "Japanese",
    vi: "Vietnamese",
    en: "English",
    ko: "Korean",
    "zh-CN": "Simplified Chinese",
    "zh-TW": "Traditional Chinese",
    th: "Thai",
    id: "Indonesian",
    fr: "French",
    de: "German",
    es: "Spanish",
    pt: "Portuguese",
  });
  const STYLE_GUIDELINES = Object.freeze({
    technical:
      "Style: Technical, clear, and action-oriented for Software Engineers & QA/Testers. Keep technical terms in English (e.g. API, endpoint, query, deploy, payload, database). Clearly distinguish current vs expected behavior.",
    formal:
      "Style: Formal, polite, and professional business language suitable for project managers and clients.",
    concise:
      "Style: Highly concise, action-focused checklist and bullet points. Eliminate all filler words.",
  });
  const translationDefaults = Object.freeze({
    source: "ja",
    target: "vi",
    reverseMode: "extract",
    reverseSource: "vi",
    reverseTarget: "ja",
    tone: "technical",
  });
  function normalizeTranslationRules(value = {}) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("Invalid translation rules.");
    }
    const rules = { ...translationDefaults, ...value };
    for (const key of ["source", "target", "reverseSource", "reverseTarget"]) {
      if (!supportedLanguages.has(rules[key]) || (key !== "source" && rules[key] === "auto")) {
        throw new TypeError("Invalid translation language.");
      }
    }
    if (!["extract", "translate", "original"].includes(rules.reverseMode)) {
      throw new TypeError("Invalid translation mode.");
    }
    if (rules.tone && !["technical", "formal", "concise"].includes(rules.tone)) {
      throw new TypeError("Invalid translation tone.");
    }
    rules.tone = rules.tone || "technical";
    return rules;
  }
  function safeNormalizeTranslationRules(value, fallbackSource, fallbackTarget) {
    try {
      return normalizeTranslationRules(value);
    } catch {
      // Stored value is invalid/stale — fall back to language-pair defaults
      // so getSettings() never crashes for unrelated flows (e.g. Log Time Tháng)
      return normalizeTranslationRules({
        source: fallbackSource || translationDefaults.source,
        target: fallbackTarget || translationDefaults.target,
        tone: translationDefaults.tone,
      });
    }
  }
  function translationRulesPrompt(value, reverse = false, attribution = false) {
    const rules = normalizeTranslationRules(value);
    const source = reverse ? rules.reverseSource : rules.source;
    const target = reverse ? rules.reverseTarget : rules.target;
    const instruction =
      reverse && rules.reverseMode === "extract"
        ? `Extract only original ${ENGLISH_LANGUAGE_NAMES[target]} passages from the input. Do not translate or paraphrase.`
        : `Translate from ${ENGLISH_LANGUAGE_NAMES[source]} into ${ENGLISH_LANGUAGE_NAMES[target]}.`;
    const builder = (text = "") => `${instruction}\n[BẮT ĐẦU]\n${text}\n[KẾT THÚC]`;
    builder.system = `Translate from ${ENGLISH_LANGUAGE_NAMES[source]} into ${ENGLISH_LANGUAGE_NAMES[target]}. Preserve markup, URLs, identifiers and placeholders exactly. Return only the translated content.`;
    if (reverse && rules.reverseMode === "extract") {
      builder.system = `Extract only original ${ENGLISH_LANGUAGE_NAMES[target]} passages from the input. Do not translate or paraphrase. Preserve markup and placeholders.`;
      builder.extract = true;
    } else if (rules.tone && STYLE_GUIDELINES[rules.tone]) {
      builder.system += ` ${STYLE_GUIDELINES[rules.tone]}`;
    }
    builder.attribution = attribution;
    builder.translationLabel = target.toUpperCase();
    builder.reverseMode = reverse ? rules.reverseMode : "translate";
    return builder;
  }

  global.TB_PROMPTS = {
    LANGUAGE_NAMES,
    resolveLanguagePair,
    TRANSLATION: Object.freeze({
      normalize: normalizeTranslationRules,
      safeNormalize: safeNormalizeTranslationRules,
      prompt: translationRulesPrompt,
      defaults: translationDefaults,
      languages: LANGUAGE_NAMES,
      styles: STYLE_GUIDELINES,
    }),
    GLOSSARY: (entries, prompt) =>
      `<project-terminology>${JSON.stringify(entries).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")}</project-terminology>\n${prompt}`,
    SYSTEM: `Thực hiện yêu cầu dịch hoặc trích xuất theo ngôn ngữ trong lời nhắc. Chỉ trả về <result>...</result>. Không giải thích/chào hỏi.

Giữ nguyên 100%: @mention (không bọc link Markdown/HTML), URL, số, markdown/HTML (<u>, <span style>, <mark>), code (\`\`\`/\`), [[TB_IMG:id]], [[TB_FILE:id:name]], !file.ext!, placeholder kiểu <flow_guide_id> / <id> (giữ nguyên ký tự <>, tuyệt đối không HTML-escape thành &lt; &gt;).
Không tóm tắt, không bỏ câu, không đổi marker/code.
Thuật ngữ kỹ thuật thông dụng giữ tiếng Anh.
Với tên chức năng khó hiểu, giữ tên gốc rồi thêm bản dịch trong ngoặc.
Đoạn đã ở ngôn ngữ đích: chỉ chỉnh nhẹ cho tự nhiên, không viết lại toàn bộ.`,
    USER: translationPrompt,
    SIMPLE_TRANSLATE: (text, settings) => translationPrompt(text, settings),
    EXTRACT_JAPANESE: (
      text
    ) => `Chỉ trích xuất phần tiếng Nhật. Bỏ tiếng Việt/thừa. Giữ markdown nếu có.
[BẮT ĐẦU]
${text}
[KẾT THÚC]`,
  };
})(globalThis);
