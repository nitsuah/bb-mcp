import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);
const pkg = _require("../package.json") as { name: string; version: string };

export const SERVER_NAME: string = pkg.name;
export const SERVER_VERSION: string = pkg.version;
