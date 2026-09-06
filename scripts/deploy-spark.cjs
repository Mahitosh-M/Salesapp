const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const config = JSON.parse(fs.readFileSync("firebase.spark.json", "utf8"));
if (config.functions)
  throw Error("Spark deployment must not include Functions");
const env = { ...process.env, VITE_USE_EMULATORS: "false", DEBUG: "" };
for (const [cmd, args] of [
  ["npm", ["run", "build"]],
  [
    "firebase",
    [
      "deploy",
      "--config",
      "firebase.spark.json",
      "--project",
      "salesapp-aaa7b",
      "--only",
      "firestore,hosting",
      "--non-interactive",
    ],
  ],
]) {
  const r = spawnSync(process.platform === "win32" ? cmd + ".cmd" : cmd, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status || 1);
}
