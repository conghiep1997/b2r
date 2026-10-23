const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync("src/modules/utils/custom-fields.js", "utf8"), context);
vm.runInContext(fs.readFileSync("src/modules/utils/sync-rules.js", "utf8"), context);

test("custom fields accept project-specific names, API values and optional tracker scope", () => {
  const fields = context.TB_CUSTOM_FIELDS;
  const value = [
    {
      id: 77,
      name: "Customer priority",
      type: "select",
      required: true,
      options: ["P1", "P2"],
      trackers: ["Support"],
      defaultValue: "P2",
    },
  ];
  assert.equal(fields.normalize(value)[0].defaultValue, "P2");
  assert.equal(fields.normalize([]).length, 0);
  assert.equal(fields.legacy("{}").length, 0);
  assert.equal(fields.legacy('{"Severity":77}')[0].id, 77);
  for (const invalid of [
    [{ ...value[0], id: 0 }],
    [value[0], value[0]],
    [{ ...value[0], options: [] }],
    [{ ...value[0], defaultValue: "Unknown" }],
    [{ ...value[0], defaultValue: 0 }],
  ])
    assert.throws(() => fields.normalize(invalid));
});

test("date rules support arbitrary tracker names and reject invalid working-day counts", () => {
  const rules = context.TB_SYNC_RULES;
  assert.equal(
    rules.normalize({ dueDateRules: { Support: { required: true, workingDays: 2 } } }).dueDateRules
      .Support.workingDays,
    2
  );
  assert.equal(Object.keys(rules.normalize({ dueDateRules: {} }).dueDateRules).length, 0);
  for (const workingDays of [-1, 61, 1.5, "3"])
    assert.throws(() =>
      rules.normalize({ dueDateRules: { Support: { required: true, workingDays } } })
    );
});
