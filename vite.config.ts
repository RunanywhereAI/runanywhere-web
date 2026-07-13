import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Copies the four canonical Emscripten WASM artifacts from the @runanywhere
 * npm packages into dist/assets/ so they're served alongside the bundled JS
 * at runtime.
 *
 * In dev mode, Vite serves node_modules directly so this only matters for
 * production builds.
 *
 * Four JS/WASM artifact pairs ship across three SDK packages:
 *   - `racommons.{js,wasm}` (commons core, owned by `@runanywhere/web`)
 *   - `racommons-llamacpp.{js,wasm}` (CPU LLM/VLM backend)
 *   - `racommons-llamacpp-webgpu.{js,wasm}` (WebGPU LLM/VLM backend)
 *   - `racommons-onnx-sherpa.{js,wasm}` (STT/TTS/VAD via Sherpa-ONNX)
 */
function copyWasmPlugin(): Plugin {
  const coreWasm = path.resolve(__dir, 'node_modules/@runanywhere/web/wasm');
  const llamacppWasm = path.resolve(__dir, 'node_modules/@runanywhere/web-llamacpp/wasm');
  const onnxWasm = path.resolve(__dir, 'node_modules/@runanywhere/web-onnx/wasm');

  const wasmArtifacts = [
    { directory: coreWasm, baseName: 'racommons' },
    { directory: llamacppWasm, baseName: 'racommons-llamacpp' },
    { directory: llamacppWasm, baseName: 'racommons-llamacpp-webgpu' },
    { directory: onnxWasm, baseName: 'racommons-onnx-sherpa' },
  ] as const;

  return {
    name: 'copy-wasm',
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dir, 'dist');
      const assetsDir = path.join(outDir, 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });

      for (const { directory, baseName } of wasmArtifacts) {
        for (const extension of ['js', 'wasm'] as const) {
          const srcPath = path.join(directory, `${baseName}.${extension}`);
          const destPath = path.join(assetsDir, `${baseName}.${extension}`);
          if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            const sizeMB = (fs.statSync(srcPath).size / 1_000_000).toFixed(1);
            console.log(`  ✓ Copied ${baseName}.${extension} (${sizeMB} MB)`);
          } else {
            console.warn(`  ⚠ Not found: ${srcPath}`);
          }
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyWasmPlugin()],
  server: {
    headers: {
      // Cross-Origin Isolation — required for SharedArrayBuffer / multi-threaded WASM.
      // Without these headers the SDK falls back to single-threaded mode.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  assetsInclude: ['**/*.wasm'],
  worker: { format: 'es' },
  optimizeDeps: {
    // Exclude WASM-bearing packages from pre-bundling so their
    // import.meta.url resolves correctly to node_modules paths
    // (needed for automatic WASM file discovery at ../../wasm/).
    exclude: ['@runanywhere/web', '@runanywhere/web-llamacpp', '@runanywhere/web-onnx'],
  },
});
