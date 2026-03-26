// build.js
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

const EXCLUDE_DIRS = new Set([
  "dist",
  "node_modules",
  ".git",
  ".netlify",
]);

function rmDir(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;

  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function copyFileSafe(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyRootStaticFiles() {
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });

  for (const entry of entries) {
    const name = entry.name;
    const src = path.join(ROOT, name);
    const dest = path.join(DIST, name);

    if (EXCLUDE_DIRS.has(name)) continue;

    if (entry.isDirectory()) {
      // 이미 개별 복사할 폴더들은 아래에서 처리
      continue;
    }

    // 루트 정적 파일 자동 복사
    // 예: index.html, landing.html, robots.txt, sitemap.xml, manifest.json 등
    const ext = path.extname(name).toLowerCase();
    const allowed = new Set([
      ".html",
      ".xml",
      ".txt",
      ".json",
      ".webmanifest",
      ".ico",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".svg",
      ".pdf",
      ".js",
      ".css",
    ]);

    if (allowed.has(ext)) {
      ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
    }
  }
}

function walkHtmlFiles(dir, result = []) {
  if (!fs.existsSync(dir)) return result;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(full, result);
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".html") {
      result.push(full);
    }
  }
  return result;
}

function replaceAssetRefsInHtml(html) {
  let out = html;

  // CSS 교체
  out = out.replace(
    /(<link\b[^>]*href=["'])\/assets\/css\/style\.css(["'][^>]*>)/g,
    `$1/assets/css/style.min.css$2`
  );

  // JS 교체
  out = out.replace(
    /(<script\b[^>]*src=["'])\/assets\/js\/app\.js(["'][^>]*><\/script>)/g,
    `$1/assets/js/app.min.js$2`
  );

  return out;
}

function patchAllHtmlFiles() {
  const htmlFiles = walkHtmlFiles(DIST);

  for (const file of htmlFiles) {
    let html = fs.readFileSync(file, "utf8");
    html = replaceAssetRefsInHtml(html);
    fs.writeFileSync(file, html, "utf8");
  }
}

// 1) dist 초기화
rmDir(DIST);
ensureDir(DIST);

// 2) 폴더 복사
copyRecursive(path.join(ROOT, "assets"), path.join(DIST, "assets"));
copyRecursive(path.join(ROOT, "calculator"), path.join(DIST, "calculator"));
copyRecursive(path.join(ROOT, "ddyd"), path.join(DIST, "ddyd"));
copyRecursive(path.join(ROOT, "en"), path.join(DIST, "en"));
copyRecursive(path.join(ROOT, "ddclean"), path.join(DIST, "ddclean"));
copyRecursive(path.join(ROOT, "ac-clean"), path.join(DIST, "ac-clean"));
copyRecursive(path.join(ROOT, "admin"), path.join(DIST, "admin"));
copyRecursive(path.join(ROOT, "netlify"), path.join(DIST, "netlify"));

// 3) 루트 정적 파일 자동 복사
//    여기서 index.html, landing.html 등이 dist로 들어감
copyRootStaticFiles();

// 4) config.js 별도 보장 복사
if (fs.existsSync(path.join(ROOT, "config.js"))) {
  fs.copyFileSync(path.join(ROOT, "config.js"), path.join(DIST, "config.js"));
}

// 5) CSS minify (style.css → style.min.css)
const cssIn = path.join(ROOT, "assets", "css", "style.css");
const cssOut = path.join(DIST, "assets", "css", "style.min.css");
ensureDir(path.dirname(cssOut));

if (fs.existsSync(cssIn)) {
  try {
    run(`npx cleancss -O2 -o "${cssOut}" "${cssIn}"`);
  } catch (err) {
    console.warn("⚠️ CSS minify 실패. 원본 CSS를 그대로 복사합니다.");
    copyFileSafe(cssIn, cssOut);
  }
} else {
  console.warn("⚠️ assets/css/style.css 파일이 없습니다. CSS minify를 건너뜁니다.");
}

// 6) JS minify + obfuscate (app.js → app.min.js)
const jsIn = path.join(ROOT, "assets", "js", "app.js");
const jsMin = path.join(DIST, "assets", "js", "app.min.js");
const jsTmp = path.join(DIST, "assets", "js", "__tmp.min.js");
ensureDir(path.dirname(jsMin));

if (fs.existsSync(jsIn)) {
  try {
    // terser로 1차 압축
    run(`npx terser "${jsIn}" -c -m -o "${jsTmp}"`);

    // 난독화
    run(
      `npx javascript-obfuscator "${jsTmp}" --output "${jsMin}" ` +
        `--compact true ` +
        `--control-flow-flattening false ` +
        `--dead-code-injection false ` +
        `--debug-protection false ` +
        `--disable-console-output false ` +
        `--string-array true ` +
        `--string-array-encoding base64 ` +
        `--string-array-threshold 0.75`
    );
  } catch (err) {
    console.warn("⚠️ JS minify/obfuscate 실패. 원본 JS를 그대로 복사합니다.");
    copyFileSafe(jsIn, jsMin);
  } finally {
    if (fs.existsSync(jsTmp)) fs.unlinkSync(jsTmp);
  }
} else {
  console.warn("⚠️ assets/js/app.js 파일이 없습니다. JS minify를 건너뜁니다.");
}

// 7) dist 안의 모든 html에서 css/js 경로를 min 파일로 교체
patchAllHtmlFiles();

console.log("\n✅ Build done. dist/ is ready.\n");
