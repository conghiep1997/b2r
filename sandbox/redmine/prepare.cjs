/** Generates local secrets only. Never starts Docker or connects to any service. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const directory = path.join(__dirname, "secrets");
fs.mkdirSync(directory, { recursive: true });
for (const filename of ["db_password.txt", "session_secret.txt"]) {
  try {
    fs.writeFileSync(path.join(directory, filename), crypto.randomBytes(48).toString("hex"), { flag: "wx", mode: 0o600 });
    console.log(`Created secrets/${filename}`);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log(`Kept existing secrets/${filename}`);
  }
}
console.log("Prepared local Redmine configuration. No containers have been started.");
