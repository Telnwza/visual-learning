import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDirectory = path.join(root, "dist", "server");
const sourceFiles = [
  "index.html",
  "css/style.css",
  "css/simulator-shell.css",
  "css/automata-notebook.css",
  "js/main.js",
  "js/simulator-shell.js",
  "automata/index.html",
  "automata/automata-equation.js",
  "automata/practice-generator.js",
  "schematic2vhdl/index.html",
  "schematic2vhdl-v2/index.html",
  "vectors/index.html",
  "logic-gates/index.html",
  "logic-gates/style.css",
  "logic-gates/logic-engine.js",
  "logic-gates/app.js",
  "block-schematic-studio/index.html",
  "block-schematic-studio/style.css",
  "block-schematic-studio/app.js",
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const assets = Object.fromEntries(sourceFiles.map((relativePath) => {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`Missing site asset: ${relativePath}`);
  return [`/${relativePath}`, {
    body: fs.readFileSync(absolutePath, "utf8"),
    type: mimeTypes[path.extname(relativePath)] || "application/octet-stream",
  }];
}));

const worker = `const assets = ${JSON.stringify(assets)};

function assetPath(pathname) {
  let value;
  try {
    value = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (value === "/") return "/index.html";
  if (value.endsWith("/")) return value + "index.html";
  if (!value.split("/").pop().includes(".")) return value + "/index.html";
  return value;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const key = assetPath(url.pathname);
    const asset = key ? assets[key] : null;
    if (!asset) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return new Response(request.method === "HEAD" ? null : asset.body, {
      status: 200,
      headers: {
        "content-type": asset.type,
        "cache-control": key.endsWith(".html") ? "no-cache" : "public, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  },
};
`;

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "index.js"), worker);
console.log(`Built Sites worker with ${sourceFiles.length} static assets.`);
