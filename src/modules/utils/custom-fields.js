/** User-defined migration fields, with an explicit compatibility adapter for old mappings. */
(function (global) {
  function normalize(value) {
    if (value === null || value === undefined) return null;
    if (!Array.isArray(value) || value.length > 100) {
      throw new TypeError("Custom fields must be a list of at most 100 fields.");
    }
    const seen = new Set();
    return value.map((field) => {
      if (
        !field ||
        !Number.isSafeInteger(Number(field.id)) ||
        Number(field.id) <= 0 ||
        typeof field.name !== "string" ||
        !field.name.trim() ||
        field.name.length > 150 ||
        !["text", "select"].includes(field.type) ||
        typeof field.required !== "boolean"
      ) {
        throw new TypeError("Invalid custom-field definition.");
      }
      if (seen.has(Number(field.id))) throw new TypeError("Custom-field IDs must be unique.");
      seen.add(Number(field.id));
      const options = field.options || [];
      const trackers = field.trackers || [];
      for (const entries of [options, trackers]) {
        if (
          !Array.isArray(entries) ||
          entries.length > 100 ||
          entries.some((entry) => typeof entry !== "string" || !entry.trim() || entry.length > 300)
        ) {
          throw new TypeError("Invalid custom-field options or trackers.");
        }
      }
      if (field.type === "select" && !options.length) {
        throw new TypeError("Select fields need at least one option.");
      }
      const defaultValue = field.defaultValue ?? "";
      if (
        typeof defaultValue !== "string" ||
        defaultValue.length > 300 ||
        (field.type === "select" && defaultValue && !options.includes(defaultValue))
      ) {
        throw new TypeError("Invalid custom-field default value.");
      }
      return {
        id: Number(field.id),
        name: field.name.trim(),
        type: field.type,
        required: field.required,
        options: [...new Set(options)],
        trackers: [...new Set(trackers)],
        defaultValue,
      };
    });
  }
  function legacy(value = "{}") {
    const ids = JSON.parse(value || "{}");
    const choices = {
      Severity: ["Critical", "Major", "Minor", "Trivial"],
      Role: [
        "Business Analysis",
        "Developer",
        "Tester",
        "Quality Assurance",
        "Reporter",
        "Comtor",
        "Customer",
        "Others",
      ],
      "QC Activity": [
        "Document Review",
        "Code Review",
        "Unit Test",
        "Integration Test",
        "Acceptance Test",
      ],
      "Q&A Category": [
        "10_Requirement",
        "20_Database Definition",
        "30_UI Design",
        "40_Logic",
        "50_Technical Issue",
        "60_API",
        "70_DLL",
        "80_Test Data",
        "90_Other",
      ],
    };
    return normalize(
      Object.entries(ids)
        .filter(([, id]) => Number(id) > 0)
        .map(([name, id]) => ({
          id: Number(id),
          name,
          type: choices[name] ? "select" : "text",
          required: true,
          options: choices[name] || [],
          trackers:
            name === "Q&A Category"
              ? ["Q/A", "Q&A"]
              : name === "Severity"
                ? ["Bug", "Q/A", "Q&A", "CR"]
                : ["Bug", "Q/A", "Q&A"],
          defaultValue: name === "Reproduction Rate" ? "100%" : "",
        }))
    );
  }
  global.TB_CUSTOM_FIELDS = Object.freeze({ normalize, legacy });
})(globalThis);
