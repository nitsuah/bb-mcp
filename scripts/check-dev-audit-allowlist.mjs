import fs from "node:fs";
import { spawnSync } from "node:child_process";

const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const auditRun = spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });
let audit;
try {
  audit = JSON.parse(auditRun.stdout);
} catch {
  throw new Error("npm audit did not return valid JSON; refusing to apply the advisory allowlist.");
}
const advisory = "GHSA-fc5q-39xc-vjpf";
const picomatch = lock.packages?.["node_modules/picomatch"];

if (!picomatch || picomatch.dev !== true || picomatch.version !== "4.0.7") {
  throw new Error("The known advisory allowlist is only valid for dev-only picomatch@4.0.7; review the dependency graph.");
}
if (!JSON.stringify(audit).includes(advisory)) {
  throw new Error("Expected advisory " + advisory + " was not present in the audit report; remove or revise the allowlist.");
}
console.log("Allowlisted dev-only " + advisory + " for picomatch@4.0.7; production audit is enforced separately.");
