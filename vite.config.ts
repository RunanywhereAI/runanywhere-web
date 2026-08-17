import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// __dirname is not available in ESM; derive it from import.meta.url
const __dir = path.dirname(fileURLToPath(import.meta.url));

// The app consumes the published Web SDK packages only — every module and
// every WASM artifact comes from `node_modules/@runanywhere/*`. There are no
// source aliases into any SDK checkout, so `npm install` is the single
// mechanism that decides which SDK version this app runs against.
const coreWasmDir = path.resolve(__dir, 'node_modules/@runanywhere/web/wasm');
const llamacppWasmDir = path.resolve(__dir, 'node_modules/@runanywhere/web-llamacpp/wasm');
const onnxWasmDir = path.resolve(__dir, 'node_modules/@runanywhere/web-onnx/wasm');

/**
 * `@runanywhere/proto-ts` ships as plain CommonJS (`exports.LogLevel = ...`), and
 * `@runanywhere/web`/`web-llamacpp`/`web-onnx` deep-import dozens of its generated modules
 * individually (`@runanywhere/proto-ts/logging`, `/sdk_events`, `/convenience/errors_convenience`,
 * ...) rather than the package root. Vite's dependency scanner only auto-discovers some of these
 * (its crawl is best-effort, not exhaustive) and serves the rest straight to the browser as raw
 * files; the browser's native ESM loader then can't see a CJS module's named exports and the app
 * hangs on the loading splash with "does not provide an export named '...'" — a different export
 * each time, depending on which undiscovered subpath happens to load first. Enumerating every
 * generated module here (instead of adding them to `optimizeDeps.include` one crash at a time)
 * forces esbuild to pre-bundle all of them into real ESM up front, and keeps working automatically
 * as the SDK's generated proto surface grows.
 */
function protoTsDeepImports(): string[] {
  const distDir = path.resolve(__dir, 'node_modules/@runanywhere/proto-ts/dist');
  const specifiers: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.d.js')) {
        const rel = path.relative(distDir, full).replace(/\.js$/, '').split(path.sep).join('/');
        specifiers.push(`@runanywhere/proto-ts/${rel}`);
      }
    }
  };
  walk(distDir);
  return specifiers;
}

/**
 * Vite plugin to copy the canonical Emscripten runtime artifacts into the
 * build output.
 *
 * Emscripten JS glue files resolve `.wasm` via `new URL("x.wasm", import.meta.url)`,
 * so the binaries must sit alongside the bundled JS in `dist/assets/`. Each
 * pthread-enabled glue module also starts workers using its original filename
 * (for example, `new Worker(new URL("racommons.js", import.meta.url))`). Vite
 * hashes the imported main-thread copy, so the canonical `.js` module must be
 * emitted as well; otherwise the worker request falls through to the SPA HTML
 * and Emscripten waits forever for its pthread pool.
 *
 * Four JS/WASM artifact pairs (eight runtime files) ship across three SDK
 * packages. Diffusion remains workspace-only and is deliberately excluded
 * until it ships a publishable WASM artifact. Vite bundles the Emscripten JS
 * glue while this plugin copies each canonical pair next to it:
 *   - `racommons.{js,wasm}` (commons core, owned by `@runanywhere/web`)
 *   - `racommons-llamacpp.{js,wasm}` (CPU LLM backend)
 *   - `racommons-llamacpp-webgpu.{js,wasm}` (WebGPU LLM backend)
 *   - `racommons-onnx-sherpa.{js,wasm}` (STT/TTS/VAD via Sherpa-ONNX CPU)
 *   - `racommons-onnx-sherpa-webgpu.{js,wasm}` (speech WebGPU EP path twin)
 */
const wasmArtifacts = [
  { directory: coreWasmDir, baseName: 'racommons' },
  { directory: llamacppWasmDir, baseName: 'racommons-llamacpp' },
  { directory: llamacppWasmDir, baseName: 'racommons-llamacpp-webgpu' },
  { directory: onnxWasmDir, baseName: 'racommons-onnx-sherpa' },
  { directory: onnxWasmDir, baseName: 'racommons-onnx-sherpa-webgpu' },
] as const;

function copyWasmPlugin(requireCompleteArtifacts: boolean): Plugin {
  const requiredFiles = wasmArtifacts.flatMap(({ directory, baseName }) => [
    path.join(directory, `${baseName}.js`),
    path.join(directory, `${baseName}.wasm`),
  ]);

  return {
    name: 'copy-wasm',
    buildStart() {
      // Keep `vite` development startup lightweight, but never produce a
      // partial production bundle that will fail only after deployment.
      if (!requireCompleteArtifacts) return;

      const missingOrEmpty = requiredFiles.filter(
        (file) => !fs.existsSync(file) || fs.statSync(file).size === 0,
      );
      if (missingOrEmpty.length > 0) {
        const formattedFiles = missingOrEmpty
          .map((file) => `  - ${path.relative(__dir, file)}`)
          .join('\n');
        this.error(
          `Required Web SDK WASM artifacts are missing or empty:\n${formattedFiles}\n` +
            'These ship inside the published @runanywhere/web, @runanywhere/web-llamacpp, ' +
            'and @runanywhere/web-onnx packages — run `npm install` to restore them.',
        );
      }
    },
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dir, 'dist');
      const assetsDir = path.join(outDir, 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });

      for (const { directory, baseName } of wasmArtifacts) {
        for (const extension of ['js', 'wasm'] as const) {
          const src = path.join(directory, `${baseName}.${extension}`);
          const dest = `${baseName}.${extension}`;
          fs.copyFileSync(src, path.join(assetsDir, dest));
          const sizeMB = (fs.statSync(src).size / 1_000_000).toFixed(1);
          console.log(`  ✓ Copied ${dest} (${sizeMB} MB)`);
        }
      }
    },
  };
}

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
} as const;

export default defineConfig(({ command }) => {
  return {
    plugins: [copyWasmPlugin(command === 'build')],
    build: {
      // Vite 8 otherwise advances this floor with its moving
      // `baseline-widely-available` default on each major release. Chrome 86
      // remains the Web SDK's documented production minimum; WebGPU stays an
      // optional capability with a CPU fallback on browsers that lack it.
      target: 'chrome86',
    },
    server: {
      // Canonical URL is always http://localhost:3000 — do not advertise
      // 127.0.0.1 (different browser origin / storage).
      host: 'localhost',
      port: 3000,
      strictPort: true,
      headers: isolationHeaders,
      cors: false,
    },
    preview: {
      host: 'localhost',
      port: 3000,
      strictPort: true,
      headers: isolationHeaders,
      cors: false,
    },
    optimizeDeps: {
      exclude: ['@runanywhere/web', '@runanywhere/web-llamacpp', '@runanywhere/web-onnx'],
      // See protoTsDeepImports() above: forces every generated proto-ts module (CJS) into
      // esbuild's pre-bundle so the browser gets real ESM named exports instead of a raw
      // CommonJS file it can't read as a module.
      include: ['@runanywhere/proto-ts', ...protoTsDeepImports()],
    },
    resolve: {
      // npm ci reproduces the lockfile's nested @runanywhere/web/node_modules/@runanywhere/proto-ts
      // copy verbatim rather than hoisting it, even though it resolves to the same 0.20.24 as the
      // top-level install. Dedupe forces every resolution to the single top-level copy so there's
      // only one pre-bundled instance in the module graph.
      dedupe: ['@runanywhere/proto-ts'],
    },
    assetsInclude: ['**/*.wasm'],
  };
});
