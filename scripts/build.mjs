// Builds AI Solution Blueprint for every channel from one source.
//
//   node scripts/build.mjs             dist/ for GitHub Pages: installable PWA (index.html,
//                                      manifest, service worker, icons) plus 404.html
//   node scripts/build.mjs --preview   also dist/preview.html for sandboxed viewers
//   node scripts/build.mjs --native    mobile/www/index.html for the Google Play and App Store apps
//
// No dependencies.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

export function engineAsScript(src) {
  const names = [...src.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  const body = src.replace(/^export\s+/gm, "");
  return `const AIBlueprint = (function () {\n${body}\nreturn { ${names.join(", ")} };\n})();`;
}

function versions() {
  const pkg = JSON.parse(read("package.json"));
  const kb = JSON.parse(read("kb/knowledge-base.json"));
  return { app: pkg.version, kb: kb.kbVersion };
}

// IBM Plex Sans (SIL Open Font License, see web/fonts/OFL-LICENSE.txt) is inlined so the
// web app and the store apps render the brand font with no network requests.
function fontFaces() {
  return [400, 600, 700].map((w) => {
    const f = join(root, "web", "fonts", `ibm-plex-sans-latin-${w}-normal.woff2`);
    if (!existsSync(f)) return "";
    const b64 = readFileSync(f).toString("base64");
    return `@font-face{font-family:"IBM Plex Sans";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
  }).join("\n");
}

const PWA_HEAD = `<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="AI Blueprint">`;

const PWA_REGISTER = `<script>
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", function () { try { navigator.serviceWorker.register("sw.js").catch(function () {}); } catch (e) {} });
}
</script>`;

/**
 * target: "web" (hosted PWA), "standalone" (single offline file), "preview" (sandboxed
 * viewers) or "native" (Capacitor shell for the store apps).
 */
export function buildHtml({ target = "web", preview = false } = {}) {
  if (preview) target = "preview";
  const kb = JSON.parse(read("kb/knowledge-base.json"));
  const examples = {
    helpdesk: JSON.parse(read("examples/it-helpdesk-rag.json")),
    access: JSON.parse(read("examples/access-request-agent.json")),
    claims: JSON.parse(read("examples/claims-triage-high-risk.json"))
  };
  const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
  return read("web/index.html")
    .replace("/*__VIEWPORT__*/", target === "native" ? ", viewport-fit=cover" : "")
    .replace("<!--__HEAD__-->", target === "web" ? PWA_HEAD : "")
    .replace("<!--__BODY_END__-->", target === "web" ? PWA_REGISTER : "")
    .replace("/*__STYLES__*/", () => fontFaces() + "\n" + read("web/styles.css"))
    .replace("/*__KB__*/", () => safeJson(kb))
    .replace("/*__EXAMPLES__*/", () => safeJson(examples))
    .replace("/*__ENGINE__*/", () => engineAsScript(read("src/engine.js")))
    .replace("/*__APP__*/", () => (target === "preview" ? "const AIBP_PREVIEW = true;\n" : "") + read("web/app.js"));
}

export function manifest() {
  return {
    name: "AI Solution Blueprint by azCloudOps",
    short_name: "AI Blueprint",
    description: "Design an enterprise AI solution from idea to production: pattern, architecture, governance, cost and readiness.",
    id: "./",
    start_url: "./",
    scope: "./",
    display: "standalone",
    orientation: "any",
    background_color: "#FFFFFF",
    theme_color: "#2F6FD6",
    categories: ["business", "productivity", "developer"],
    icons: [
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}

function copyIcons(outDir) {
  // Icons are generated from assets/icon.svg by scripts/render-assets (see docs/MOBILE.md)
  // and committed under assets/web-icons so the build stays dependency free.
  const src = join(root, "assets", "web-icons");
  if (!existsSync(src)) return false;
  mkdirSync(join(outDir, "icons"), { recursive: true });
  for (const f of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
    if (existsSync(join(src, f))) copyFileSync(join(src, f), join(outDir, "icons", f));
  }
  return true;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const v = versions();
  if (process.argv.includes("--native")) {
    const out = join(root, "mobile", "www");
    mkdirSync(out, { recursive: true });
    const html = buildHtml({ target: "native" });
    writeFileSync(join(out, "index.html"), html);
    console.log(`Built mobile/www/index.html for the store apps (${(html.length / 1024).toFixed(1)} KB, app ${v.app}, kb ${v.kb})`);
  } else {
    const out = join(root, "dist");
    mkdirSync(out, { recursive: true });
    const html = buildHtml({ target: "web" });
    writeFileSync(join(out, "index.html"), html);
    writeFileSync(join(out, "404.html"), html);
    writeFileSync(join(out, "manifest.webmanifest"), JSON.stringify(manifest(), null, 2));
    writeFileSync(join(out, "sw.js"), read("web/sw.js").replace("__CACHE_VERSION__", `${v.app}-${v.kb}`));
    const icons = copyIcons(out);
    if (process.argv.includes("--preview")) writeFileSync(join(out, "preview.html"), buildHtml({ target: "preview" }));
    // Single self-contained file attached to GitHub Releases (no PWA references).
    writeFileSync(join(out, "ai-solution-blueprint.html"), buildHtml({ target: "standalone" }));
    console.log(`Built dist/ (${(html.length / 1024).toFixed(1)} KB page, PWA manifest, service worker${icons ? ", icons" : ""})`);
  }
}
