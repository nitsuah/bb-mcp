#!/usr/bin/env node
/**
 * Generates the README/Pages visuals from the real tool manifest and RBAC
 * policy (bb-mcp has no web UI, so there is nothing to screenshot).
 *
 *   npm run build && node scripts/visual-docs.mjs
 *
 * Output: docs/screenshots/<feature-id>.png (plus the .svg it is drawn from).
 * Deterministic: no clock, no randomness, fixed fixture for the chat turn.
 * PNG rasterising uses @resvg/resvg-js (install with --no-save in CI).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.BB_CLIENT_ID ??= "docs-client-id";
process.env.BB_CLIENT_SECRET ??= "docs-client-secret";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs", "screenshots");
const { buildProviderManifest } = await import(
  new URL("../dist/manifest.js", import.meta.url)
);
const manifest = buildProviderManifest("http://localhost:3100");
const tools = manifest.tools;

const FONT = "DejaVu Sans Mono, Liberation Mono, monospace";
const C = {
  bg: "#0f172a",
  panel: "#1e293b",
  line: "#334155",
  text: "#e2e8f0",
  dim: "#94a3b8",
  accent: "#38bdf8",
  student: "#4ade80",
  instructor: "#fbbf24",
  admin: "#f87171",
  parent: "#c084fc",
};
const ROLES = ["student", "instructor", "admin", "parent"];
const CW = 0.602; // monospace advance in em

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const text = (x, y, s, size, fill, extra = "") =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`;
const svgDoc = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n<rect width="${w}" height="${h}" fill="${C.bg}"/>\n${body}\n</svg>\n`;

// ── 1. Tool catalog: every shipped tool, grouped by who may call it ───────
function toolCatalog() {
  const W = 1600;
  const groups = new Map();
  for (const t of tools) {
    const key = t.roles.join(" · ");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t.name);
  }
  const ordered = [...groups.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  let y = 120;
  let body = text(
    48,
    62,
    `${manifest.name} · ${tools.length} MCP tools`,
    30,
    C.text,
    'font-weight="bold"',
  );
  body += text(
    48,
    92,
    "grouped by the roles allowed to call them (tools/list, src/rbac.ts)",
    16,
    C.dim,
  );
  for (const [roles, names] of ordered) {
    body += text(48, y + 20, roles, 16, C.accent, 'font-weight="bold"');
    y += 36;
    let x = 48;
    for (const n of names) {
      const w = Math.ceil(n.length * 14 * CW + 28);
      if (x + w > W - 48) {
        x = 48;
        y += 44;
      }
      body += `<rect x="${x}" y="${y}" width="${w}" height="34" rx="8" fill="${C.panel}" stroke="${C.line}"/>`;
      body += text(x + 14, y + 22, n, 14, C.text);
      x += w + 12;
    }
    y += 62;
  }
  return svgDoc(W, y + 10, body);
}

// ── 2. RBAC matrix: tool x role, straight from the policy map ─────────────
function rbacMatrix() {
  const W = 1600;
  const half = Math.ceil(tools.length / 2);
  const rowH = 30;
  const top = 150;
  let body = text(
    48,
    62,
    "RBAC middleware · who can call what",
    30,
    C.text,
    'font-weight="bold"',
  );
  body += text(
    48,
    92,
    "deny by default: a tool missing from the policy is callable by nobody (src/rbac.ts)",
    16,
    C.dim,
  );
  [tools.slice(0, half), tools.slice(half)].forEach((col, ci) => {
    const x0 = 48 + ci * 770;
    ROLES.forEach((r, i) => {
      body += text(
        x0 + 360 + i * 100,
        top - 14,
        r,
        13,
        C[r],
        'text-anchor="middle" font-weight="bold"',
      );
    });
    col.forEach((t, ri) => {
      const y = top + ri * rowH;
      if (ri % 2 === 0)
        body += `<rect x="${x0 - 8}" y="${y - 6}" width="740" height="${rowH}" rx="6" fill="${C.panel}"/>`;
      body += text(x0, y + 14, t.name, 14, C.text);
      ROLES.forEach((r, i) => {
        if (t.roles.includes(r))
          body += `<circle cx="${x0 + 360 + i * 100}" cy="${y + 9}" r="7" fill="${C[r]}"/>`;
        else
          body += text(
            x0 + 360 + i * 100,
            y + 14,
            "-",
            14,
            C.line,
            'text-anchor="middle"',
          );
      });
    });
  });
  return svgDoc(W, top + half * rowH + 40, body);
}

// ── 3. One tool call rendered as a chat turn (fixed, fictional fixture) ───
function toolCall() {
  const W = 1400;
  // Same shape and average calculation as getMyGradesHandler in src/tools/student.ts
  const grades = [
    {
      columnId: "_101_1",
      status: "Graded",
      score: 92,
      text: "92",
      feedback: "Clear lab write-up.",
    },
    {
      columnId: "_101_2",
      status: "Graded",
      score: 85,
      text: "85",
      feedback: null,
    },
    {
      columnId: "_101_3",
      status: "NeedsGrading",
      score: null,
      text: null,
      feedback: null,
    },
  ];
  const scored = grades.filter((g) => g.score != null);
  const avg = (scored.reduce((s, g) => s + g.score, 0) / scored.length).toFixed(
    1,
  );
  const result = [
    {
      course: "Intro to Biology",
      courseId: "BIO-101-FA",
      average: avg,
      grades,
    },
  ];
  const call = [
    "get_my_grades({",
    '  "caller_identity": { "userId": "student-1", "role": "student" },',
    '  "courseId": "BIO-101-FA"',
    "})",
  ];
  const resp = JSON.stringify(result, null, 2).split("\n");
  let y = 60;
  let body = "";
  const bubble = (label, color, lines, size, x, w) => {
    const h = 44 + lines.length * (size + 7);
    let b = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${C.panel}" stroke="${color}" stroke-opacity="0.6"/>`;
    b += text(x + 22, y + 28, label, 13, color, 'font-weight="bold"');
    lines.forEach((l, i) => {
      b += text(
        x + 22,
        y + 56 + i * (size + 7),
        l,
        size,
        C.text,
        'xml:space="preserve"',
      );
    });
    y += h + 24;
    return b;
  };
  body += bubble(
    "STUDENT",
    C.student,
    ["How am I doing in Intro to Biology?"],
    17,
    48,
    700,
  );
  body += bubble("ASSISTANT · tools/call", C.accent, call, 15, 48, 1000);
  body += bubble(
    "RESPONSE · scrubbed, role-checked",
    C.instructor,
    resp.slice(0, 13).concat(["      ..."]),
    14,
    48,
    1000,
  );
  body += bubble(
    "ASSISTANT",
    C.accent,
    [
      `You're averaging ${avg} on the two graded items; one is awaiting grading.`,
    ],
    17,
    48,
    1200,
  );
  return svgDoc(W, y + 20, body);
}

const outputs = {
  "standardized-tool-schema": toolCatalog(),
  "rbac-middleware": rbacMatrix(),
  getmygrades: toolCall(),
};

mkdirSync(outDir, { recursive: true });
let Resvg = null;
try {
  ({ Resvg } = await import("@resvg/resvg-js"));
} catch {
  console.warn("@resvg/resvg-js not installed: writing SVG only");
}
// resvg-js does not pick up system fonts reliably: pass the files explicitly.
const fontFiles = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
].filter(existsSync);
if (!Resvg && process.env.CI) {
  throw new Error("@resvg/resvg-js is required in CI to generate the PNGs");
}
if (Resvg && fontFiles.length === 0) {
  throw new Error(
    "DejaVu Sans Mono not found: apt-get install fonts-dejavu-core",
  );
}
for (const [id, svg] of Object.entries(outputs)) {
  writeFileSync(join(outDir, `${id}.svg`), svg);
  if (Resvg) {
    const png = new Resvg(svg, {
      font: {
        fontFiles,
        loadSystemFonts: false,
        defaultFontFamily: "DejaVu Sans Mono",
      },
    })
      .render()
      .asPng();
    writeFileSync(join(outDir, `${id}.png`), png);
  }
  console.log(`wrote docs/screenshots/${id}`);
}
