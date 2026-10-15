// Serves a folder over HTTP for the Pages-site journey (no dependencies).
//   node tests/journeys/static-server.mjs docs/brag 4173
// Supports Range requests so a <video> can load metadata.
import http from "node:http";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "docs/brag");
const port = Number(process.argv[3] ?? 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
};

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if (statSync(file).isDirectory()) file = path.join(file, "index.html");
      const { size } = statSync(file);
      const type = TYPES[path.extname(file)] ?? "application/octet-stream";
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
      if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Number(range[2]) : size - 1;
        res.writeHead(206, {
          "Content-Type": type,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": end - start + 1,
        });
        createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, {
        "Content-Type": type,
        "Content-Length": size,
        "Accept-Ranges": "bytes",
      });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end("Not Found");
    }
  })
  .listen(port, "127.0.0.1");
