/* global TB_SYNC_STATE */
/** Workspace/project terminology, encrypted using the existing settings codec. */
(function (global) {
  function validateProject(projectKey) {
    if (
      typeof projectKey !== "string" ||
      !/^(?:[A-Z0-9_]{1,100}|redmine:[a-zA-Z0-9_-]{1,100})$/.test(projectKey)
    ) {
      throw new TypeError("Invalid glossary project key.");
    }
    return projectKey;
  }

  function validate(entries) {
    if (!Array.isArray(entries) || entries.length > 200) {
      throw new TypeError("A glossary supports up to 200 terms.");
    }
    const seen = new Set();
    return entries.map((entry) => {
      if (
        !entry ||
        typeof entry.source !== "string" ||
        typeof entry.target !== "string" ||
        typeof entry.keep !== "boolean"
      ) {
        throw new TypeError("Each glossary term needs source, target and keep fields.");
      }
      const source = entry.source.trim();
      const target = entry.target.trim();
      if (
        !source ||
        source.length > 300 ||
        target.length > 300 ||
        Array.from(source + target).some((character) => character.charCodeAt(0) < 32) ||
        (!entry.keep && !target) ||
        seen.has(source)
      ) {
        throw new TypeError(
          "Glossary terms must be unique, nonempty and single-line (up to 300 characters)."
        );
      }
      seen.add(source);
      return { source, target: entry.keep ? source : target, keep: entry.keep };
    });
  }

  async function get(settings, projectKey) {
    const record = await TB_SYNC_STATE.read(settings, "glossary", validateProject(projectKey));
    return record ? validate(record.entries) : [];
  }

  async function save(settings, projectKey, entries) {
    const normalized = validate(entries);
    const project = validateProject(projectKey);
    return TB_SYNC_STATE.run(
      () => TB_SYNC_STATE.write(settings, "glossary", project, { entries: normalized }),
      settings,
      "glossary",
      project
    );
  }

  async function prepare(settings, projectKey, text, promptFn) {
    if (!projectKey) return { text, prompt: promptFn, restore: (output) => output };
    const entries = await get(settings, projectKey);
    if (!entries.length) return { text, prompt: promptFn, restore: (output) => output };
    const replacements = [];
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const protectedTerms = entries
      .filter((term) => term.keep)
      .sort((a, b) => b.source.length - a.source.length);
    const pattern = protectedTerms
      .map((term) => term.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const protectedText = pattern
      ? text.replace(new RegExp(pattern, "g"), (source) => {
          const token = `B2RKEEP${nonce}X${replacements.length}X`;
          replacements.push({ token, source });
          return token;
        })
      : text;
    const glossaryPrompt = (value) => TB.PROMPTS.GLOSSARY(entries, promptFn(value));
    glossaryPrompt.system = promptFn.system;
    glossaryPrompt.attribution = promptFn.attribution;
    glossaryPrompt.translationLabel = promptFn.translationLabel;
    return {
      text: protectedText,
      prompt: glossaryPrompt,
      restore(output) {
        let restored = output;
        for (const { token, source } of replacements) {
          if (
            !restored.includes(token) &&
            !promptFn.extract &&
            promptFn !== TB.PROMPTS.EXTRACT_JAPANESE
          ) {
            throw new Error(
              "AI changed a protected glossary term. Review the translation or retry."
            );
          }
          restored = restored.replaceAll(token, source);
        }
        return restored;
      },
    };
  }

  global.TB_GLOSSARY = Object.freeze({ validateProject, validate, get, save, prepare });
})(globalThis);
