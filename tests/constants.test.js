const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

test("message proxy preserves explicit localized message functions", () => {
  const context = vm.createContext({
    chrome: { i18n: { getMessage: (key) => key } },
    TB_MODELS: {},
  });
  vm.runInContext(fs.readFileSync("src/constants.js", "utf8"), context);
  context.TB_SET_LOCALE_MESSAGES({
    options_save_error: { message: "Save failed: $error$" },
    modal_char_count: { message: "$count$ characters" },
  });

  assert.equal(
    context.TB.MESSAGES.SETTINGS.OPTIONS_SAVE_ERROR("invalid setting"),
    "Save failed: invalid setting"
  );
  assert.equal(context.TB.MESSAGES.MODAL.CHAR_COUNT(12), "12 characters");
});
