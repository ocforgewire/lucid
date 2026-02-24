// ============================================
// LUCID Extension — Bun Build Script
// ============================================

import { watch } from "fs";
import { cp, mkdir, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";

const ROOT = import.meta.dir;
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const isWatch = process.argv.includes("--watch");

async function clean() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
}

async function buildContentScripts() {
  const result = await Bun.build({
    entrypoints: [join(SRC, "content", "main.ts")],
    outdir: join(DIST, "content"),
    target: "browser",
    format: "iife",
    minify: !isWatch,
    sourcemap: isWatch ? "inline" : "none",
    define: {
      "process.env.NODE_ENV": isWatch ? '"development"' : '"production"',
    },
  });

  if (!result.success) {
    console.error("Content script build failed:");
    for (const log of result.logs) console.error(String(log));
    return false;
  }
  return true;
}

async function buildServiceWorker() {
  const result = await Bun.build({
    entrypoints: [join(SRC, "background", "service-worker.ts")],
    outdir: join(DIST, "background"),
    target: "browser",
    format: "esm",
    minify: !isWatch,
    sourcemap: isWatch ? "inline" : "none",
    define: {
      "process.env.NODE_ENV": isWatch ? '"development"' : '"production"',
    },
  });

  if (!result.success) {
    console.error("Service worker build failed:");
    for (const log of result.logs) console.error(String(log));
    return false;
  }
  return true;
}

async function buildPopup() {
  const result = await Bun.build({
    entrypoints: [join(SRC, "popup", "popup.ts")],
    outdir: join(DIST, "popup"),
    target: "browser",
    format: "iife",
    minify: !isWatch,
    sourcemap: isWatch ? "inline" : "none",
    define: {
      "process.env.NODE_ENV": isWatch ? '"development"' : '"production"',
    },
  });

  if (!result.success) {
    console.error("Popup build failed:");
    for (const log of result.logs) console.error(String(log));
    return false;
  }
  return true;
}

async function copyStaticFiles(): Promise<boolean> {
  try {
    // Copy manifest
    await cp(join(SRC, "manifest.json"), join(DIST, "manifest.json"));

    // Copy popup HTML and CSS
    await mkdir(join(DIST, "popup"), { recursive: true });
    await cp(join(SRC, "popup", "popup.html"), join(DIST, "popup", "popup.html"));
    await cp(join(SRC, "popup", "popup.css"), join(DIST, "popup", "popup.css"));

    // Copy injected styles
    await mkdir(join(DIST, "styles"), { recursive: true });
    await cp(join(SRC, "styles", "injected.css"), join(DIST, "styles", "injected.css"));

    // Generate placeholder icons
    await generateIcons();
    return true;
  } catch (err) {
    console.error("Static file copy failed:", err);
    return false;
  }
}

async function generateIcons() {
  await mkdir(join(DIST, "icons"), { recursive: true });

  // Generate simple SVG-based PNG placeholders for each icon size
  // In production these would be real designed icons
  for (const size of [16, 48, 128]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5"/>
      <stop offset="100%" style="stop-color:#06B6D4"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="url(#g)"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="system-ui" font-size="${Math.round(size * 0.5)}" font-weight="bold">L</text>
</svg>`;

    // Write SVG as the icon placeholder
    // Chrome accepts SVG in manifest v3 icons on some builds,
    // but for maximum compatibility we write a PNG-compatible SVG wrapper.
    // For production, replace these with actual PNG files.
    await writeFile(join(DIST, "icons", `icon-${size}.png`), svg);
  }
}

async function build() {
  console.log("Building Lucid extension...");
  const start = performance.now();

  await clean();

  const results = await Promise.all([
    buildContentScripts(),
    buildServiceWorker(),
    buildPopup(),
    copyStaticFiles(),
  ]);

  const elapsed = Math.round(performance.now() - start);

  if (results.every(Boolean)) {
    console.log(`Build complete in ${elapsed}ms -> ${DIST}`);
  } else {
    console.error(`Build finished with errors in ${elapsed}ms`);
    process.exit(1);
  }
}

// Initial build
await build();

// Watch mode
if (isWatch) {
  console.log("\nWatching for changes...");

  let debounce: ReturnType<typeof setTimeout> | null = null;

  const dirs = ["content", "background", "popup", "adapters", "styles"].map(
    (d) => join(SRC, d),
  );

  // Also watch root src for manifest changes
  dirs.push(SRC);

  for (const dir of dirs) {
    try {
      watch(dir, { recursive: true }, (_event, filename) => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          console.log(`\nChanged: ${filename}`);
          build().catch(console.error);
        }, 150);
      });
    } catch {
      // Directory might not exist, that's fine
    }
  }

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\nStopping watch...");
    process.exit(0);
  });
}
