/* Minimal static server for local preview (no dependencies). */
const http = require("http");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "stitch");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const mimeByExt = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body);
}

function safePathFromUrl(urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  const withoutQuery = decoded.split("?")[0].split("#")[0];
  const normalized = path.posix.normalize(withoutQuery);
  const stripped = normalized.replace(/^(\.\.(\/|\\|$))+/, "");
  const local = stripped.startsWith("/") ? stripped.slice(1) : stripped;
  const resolved = path.resolve(rootDir, local);
  if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  if (!req.url) return send(res, 400, "Bad Request");
  const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return send(res, 405, "Method Not Allowed");

  const resolved = safePathFromUrl(urlObj.pathname);
  if (!resolved) return send(res, 400, "Bad Request");

  let filePath = resolved;
  if (urlObj.pathname.endsWith("/")) filePath = path.join(filePath, "index.html");
  if (urlObj.pathname === "/") filePath = path.join(rootDir, "index.html");

  fs.stat(filePath, (statErr, stat) => {
    if (statErr) return send(res, 404, "Not Found");
    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      return fs.readFile(indexPath, (readIndexErr, data) => {
        if (readIndexErr) return send(res, 404, "Not Found");
        const ext = path.extname(indexPath).toLowerCase();
        const type = mimeByExt[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
        if (method === "HEAD") return res.end();
        res.end(data);
      });
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) return send(res, 404, "Not Found");
      const ext = path.extname(filePath).toLowerCase();
      const type = mimeByExt[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      if (method === "HEAD") return res.end();
      res.end(data);
    });
  });
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Serving stitch/ at http://${host}:${port}/`);
});

