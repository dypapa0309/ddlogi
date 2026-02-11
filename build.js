// build.js
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

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

// 1) dist 초기화
rmDir(DIST);
ensureDir(DIST);

// 2) 기본 파일 복사 (원본 통째로 dist에 먼저 복사)
copyRecursive(path.join(ROOT, "assets"), path.join(DIST, "assets"));
copyRecursive(path.join(ROOT, "assets", "img"), path.join(DIST, "assets", "img"));
if (fs.existsSync(path.join(ROOT, "config.js"))) {
  fs.copyFileSync(path.join(ROOT, "config.js"), path.join(DIST, "config.js"));
}
fs.copyFileSync(path.join(ROOT, "index.html"), path.join(DIST, "index.html"));

// 3) CSS minify (style.css → style.min.css)
const cssIn = path.join(ROOT, "assets", "css", "style.css");
const cssOut = path.join(DIST, "assets", "css", "style.min.css");
ensureDir(path.dirname(cssOut));
run(`npx cleancss -O2 -o "${cssOut}" "${cssIn}"`);

// 4) JS minify + obfuscate (app.js → app.min.js)
const jsIn = path.join(ROOT, "assets", "js", "app.js");
const jsMin = path.join(DIST, "assets", "js", "app.min.js");
const jsTmp = path.join(DIST, "assets", "js", "__tmp.min.js");
ensureDir(path.dirname(jsMin));

// terser로 1차 압축 (sourcemap 생성 안 함)
run(`npx terser "${jsIn}" -c -m -o "${jsTmp}"`);

// 난독화 (안전옵션 위주: 깨질 확률 낮춤)
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

if (fs.existsSync(jsTmp)) fs.unlinkSync(jsTmp);

// 5) index.html에서 css/js 경로를 min 파일로 교체
const indexPath = path.join(DIST, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

// css 교체
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="\/assets\/css\/style\.css"\s*\/?>/g,
  `<link rel="stylesheet" href="/assets/css/style.min.css" />`
);

// js 교체 (defer 유지)
html = html.replace(
  /<script\s+src="\/assets\/js\/app\.js"\s+defer><\/script>/g,
  `<script src="/assets/js/app.min.js" defer></script>`
);

fs.writeFileSync(indexPath, html, "utf8");

console.log("\n✅ Build done. dist/ is ready.\n");
