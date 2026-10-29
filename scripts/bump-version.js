const fs = require("fs");
const path = require("path");

const manifestPath = path.join(__dirname, "..", "manifest.json");
const packageJsonPath = path.join(__dirname, "..", "package.json");
const changelogPath = path.join(__dirname, "..", "CHANGELOG.md");
const changelogViPath = path.join(__dirname, "..", "CHANGELOG.vi.md");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ensureChangelogStub(version) {
  const changelog = fs.readFileSync(changelogPath, "utf-8");
  const heading = `## [${version}]`;

  if (changelog.includes(heading)) {
    console.log(`OK: CHANGELOG already contains entry for ${version}`);
  } else {
    const lines = changelog.split(/\r?\n/);
    const date = formatDate();
    const stub = [
      `${heading} - ${date}`,
      "- **✨ Added**:",
      "- **🔧 Fixed**:",
      "- **📝 Docs**:",
      "",
    ];

    if (lines.length > 0 && lines[0].startsWith("# ")) {
      const updated = [lines[0], "", ...stub, ...lines.slice(1)].join("\n");
      fs.writeFileSync(changelogPath, updated, "utf-8");
    } else {
      const updated = ["# Changelog - Backlog2Redmine", "", ...stub, ...lines].join("\n");
      fs.writeFileSync(changelogPath, updated, "utf-8");
    }

    console.log(`OK: Added CHANGELOG stub entry for version ${version}`);
  }

  if (fs.existsSync(changelogViPath)) {
    const changelogVi = fs.readFileSync(changelogViPath, "utf-8");
    if (changelogVi.includes(heading)) {
      console.log(`OK: CHANGELOG.vi already contains entry for ${version}`);
    } else {
      const linesVi = changelogVi.split(/\r?\n/);
      const date = formatDate();
      const stubVi = [
        `${heading} - ${date}`,
        "- **✨ Thêm mới**:",
        "- **🔧 Sửa lỗi**:",
        "- **📝 Tài liệu**:",
        "",
      ];

      // Find position of first version heading or insert after header
      const firstVersionIdx = linesVi.findIndex((line) => line.startsWith("## ["));
      if (firstVersionIdx !== -1) {
        const updatedVi = [
          ...linesVi.slice(0, firstVersionIdx),
          ...stubVi,
          ...linesVi.slice(firstVersionIdx),
        ].join("\n");
        fs.writeFileSync(changelogViPath, updatedVi, "utf-8");
      } else {
        const updatedVi = [
          linesVi[0] || "# Nhật ký thay đổi (Changelog)",
          "",
          ...stubVi,
          ...linesVi.slice(1),
        ].join("\n");
        fs.writeFileSync(changelogViPath, updatedVi, "utf-8");
      }

      console.log(`OK: Added CHANGELOG.vi stub entry for version ${version}`);
    }
  }
}

function isSemver(version) {
  return /^\d+\.\d+\.\d{1,2}$/.test(version);
}

function incrementPatch(version) {
  const parts = version.split(".");
  const major = parts[0];
  const minor = parts[1];
  const patch = parseInt(parts[2], 10);

  // Nếu patch cũ < 10 (1 chữ số), version tiếp theo sẽ là patch + 1 và pad 2 chữ số (e.g. 5 -> 06)
  // Nếu đã là 2 chữ số (e.g. 06), tăng bình thường thành 07
  const nextPatch = (patch + 1).toString().padStart(2, "0");
  return `${major}.${minor}.${nextPatch}`;
}

function main() {
  const requestedVersion = process.argv[2];

  const manifest = readJson(manifestPath);
  const packageJson = readJson(packageJsonPath);
  const currentVersion = manifest.version;
  const version = requestedVersion || incrementPatch(currentVersion);

  if (!isSemver(version)) {
    console.error("Usage: node scripts/bump-version.js [x.y.z]");
    process.exit(1);
  }

  if (!isSemver(currentVersion)) {
    console.error(`ERROR: Current manifest.json version is invalid: ${currentVersion}`);
    process.exit(1);
  }

  manifest.version = version;
  packageJson.version = version;
  console.log(`New version format: ${version} (2-digit patch format)`);

  writeJson(manifestPath, manifest);
  writeJson(packageJsonPath, packageJson);
  ensureChangelogStub(version);

  console.log(`OK: Updated manifest.json and package.json from ${currentVersion} to ${version}`);
  console.log("Reminder: complete the generated CHANGELOG entry before shipping.");
}

main();
