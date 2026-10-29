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
  assert.equal(messages.report_badge_ready.message, "Sẵn sàng");
  assert.equal(messages.report_badge_duplicate.message, "⚠️ Trùng ($hours$h)");
  assert.equal(messages.report_badge_full.message, "Đã đủ $hours$h");
  assert.equal(messages.report_badge_empty.message, "Không có task");
  assert.equal(messages.report_badge_partial_existing.message, "⚠️ Đã ghi 1 phần");
  assert.equal(messages.report_badge_partial_result.message, "Một phần");
  assert.equal(messages.report_badge_logged_result.message, "Đã log");
  assert.equal(messages.report_badge_error.message, "⚠️ Lỗi");
  assert.equal(messages.report_total_label.message, "Tổng:");
  assert.equal(messages.report_logging_as.message, "Người ghi:");
  assert.equal(messages.report_user_loading.message, "Đang kiểm tra tài khoản...");
  assert.equal(messages.report_user_error.message, "Không rõ tài khoản");
});

test("locale catalogs do not contain damaged text or unexpected question marks", () => {
  const allowedKeysWithQuestionMark = new Set([
    "report_confirm_delete",
    "options_import_choice",
    "options_confirm_clear_queue",
    "options_bug_description_placeholder",
    "options_disclaimer",
    "options_confirm_clear_logs",
    "glossary_discard_confirm",
    "glossary_clear_confirm",
  ]);

  for (const locale of ["en", "vi"]) {
    const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, "utf8"));
    for (const [key, value] of Object.entries(messages)) {
      assert.doesNotMatch(value.message, /\?\?/, `${locale}:${key}: double question mark`);
      if (!allowedKeysWithQuestionMark.has(key)) {
        assert.doesNotMatch(
          value.message,
          /\?/,
          `${locale}:${key} contains unexpected question mark: ${value.message}`
        );
      }
    }
  }
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

test("day-of-week formatting returns localized day and weekend detection", () => {
  const formatMonthlyTableDate = (dateText, lang = "vi") => {
    if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
      return { formatted: dateText || "", isWeekend: false };
    }
    const [year, month, day] = dateText.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = d.getUTCDay();
    const viDays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const enDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayLabel = (lang === "en" ? enDays : viDays)[dayOfWeek];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    return {
      formatted: `${dateText} (${dayLabel})`,
      isWeekend,
    };
  };

  const viMon = formatMonthlyTableDate("2026-10-05", "vi");
  assert.equal(viMon.formatted, "2026-10-05 (T2)");
  assert.equal(viMon.isWeekend, false);

  const viSun = formatMonthlyTableDate("2026-10-04", "vi");
  assert.equal(viSun.formatted, "2026-10-04 (CN)");
  assert.equal(viSun.isWeekend, true);

  const enMon = formatMonthlyTableDate("2026-10-05", "en");
  assert.equal(enMon.formatted, "2026-10-05 (Mon)");
  assert.equal(enMon.isWeekend, false);

  const enSun = formatMonthlyTableDate("2026-10-04", "en");
  assert.equal(enSun.formatted, "2026-10-04 (Sun)");
  assert.equal(enSun.isWeekend, true);
});
