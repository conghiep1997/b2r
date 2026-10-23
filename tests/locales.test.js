const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("Chrome locale catalogs declare every named placeholder", () => {
  for (const locale of ["en", "vi"]) {
    const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, "utf8"));
    for (const [key, value] of Object.entries(messages)) {
      for (const match of value.message.matchAll(/\$([a-zA-Z][\w]*)\$/g)) {
        assert.equal(
          typeof value.placeholders?.[match[1].toLowerCase()]?.content,
          "string",
          `${locale}:${key}:${match[1]}`
        );
      }
    }
  }
});

test("new Vietnamese recovery labels preserve accented UTF-8 text", () => {
  const messages = JSON.parse(fs.readFileSync("_locales/vi/messages.json", "utf8"));
  assert.equal(messages.recovery_title.message, "Khôi phục migration và mapping issue");
  assert.match(messages.sync_attachment_partial.message, /Đã gửi comment/);
});
test("Options catalogs cover static attributes and all content languages", () => {
  const html = fs.readFileSync("src/options.html", "utf8");
  const keys = [...html.matchAll(/data-i18n(?:-placeholder|-alt|-aria-label)?="([^"]+)"/g)].map(
    (match) => match[1]
  );
  const prompts = fs.readFileSync("src/modules/constants/prompts.js", "utf8");
  const languages = prompts.match(/const LANGUAGE_NAMES = Object.freeze\(\{([\s\S]*?)\}\);/)[1];
  keys.push(
    ...[...languages.matchAll(/(\w+):/g)].map((match) => `options_content_language_${match[1]}`)
  );
  for (const locale of ["en", "vi"]) {
    const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, "utf8"));
    for (const key of keys) assert.ok(messages[key]?.message, `${locale}:${key}`);
    for (const [key, value] of Object.entries(messages)) {
      if (key.startsWith("options_"))
        assert.doesNotMatch(value.message, /\?\?/, `${locale}:${key}: damaged text`);
    }
  }
});
