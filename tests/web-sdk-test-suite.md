# Manual browser test plan

Automated coverage in this repo is `npm run test` (Vitest, four files under
`src/`) plus `npm run typecheck`, `npm run lint`, and `npm run build`. None of
those load WASM or run a model. Everything below is what a person has to do in
a browser before calling a release good. The Web SDK's own Playwright suite
lives in the monorepo at `bindings/web/tests/browser/`, not here.

## Setup

1. `npm ci`, then `npm run dev` (or `npm run build && npm run preview`).
2. Open `http://localhost:3000`. Use `localhost`, not `127.0.0.1`: they are
   different origins, so OPFS contents and localStorage do not carry across.
3. In the console, confirm `crossOriginIsolated === true` and
   `typeof SharedArrayBuffer !== 'undefined'`.
4. Keep DevTools open on Console and Network for the whole pass.

Some checks need a model on disk. Download one small LLM (the model sheet lists
sizes) and one Sherpa speech bundle before starting, or run section B first.

## A. Boot

1. The boot screen paints immediately, before the bundle finishes loading, and
   its status line advances through "Starting the on-device runtime",
   "Preparing text generation", "Preparing speech", "Checking available models".
2. The shell appears: top bar with the menu button, brand, model slot, new-chat,
   theme, and settings buttons; drawer with Assistant, Talk, Choose model,
   Downloads, Settings, Advanced.
3. Console shows `[RunAnywhere] llamacpp backend registered: cpu` (or `webgpu`)
   and `[RunAnywhere] onnx/sherpa backend registered: …`.
4. Console shows `[RunAnywhere] SDK initialized, version: …` and a
   `Model registry: registered=…, downloaded=…, available=…` line.
5. `window.__RUNANYWHERE_AI_READY__.ready === true`, and `<html>` carries
   `data-runanywhere-ai-ready="true"` with `data-runanywhere-ai-step="interactive"`.
6. No unexpected console errors.

## B. Model catalog and download

1. Open the model sheet from the drawer's "Choose model" or the chat toolbar.
2. Rows list a framework, a size, and a state badge. Models the browser cannot
   run are visibly gated rather than offered.
3. "Add from Hugging Face" is present in the sheet footer.
4. Download the smallest LLM. Progress updates, then the row reads as on-device.
5. Go to Downloads: the model is listed, with the correct size, and storage
   usage reflects it.
6. Reload the page. The model still reads as on-device (OPFS survived).

## C. Assistant

1. With no model loaded, the Get Started overlay covers the composer.
2. Load a model from the sheet. The overlay clears and the toolbar names the
   model.
3. Four suggestion chips render on the empty state. Clicking one prefills the
   composer and focuses it. It does not send.
4. Send is disabled on an empty composer. Enter submits, Shift+Enter inserts a
   newline.
5. Send a prompt. Tokens stream in, then the turn completes with metrics.
6. Toggle Tools on and ask something that needs one of the three demo tools
   (weather, current time, calculator). The tool call and its result render.
7. New chat clears the thread. The drawer's Recent list keeps the previous one,
   reopening it restores the messages, and deleting it removes it.
8. Reload with a saved chat selected. It restores from IndexedDB.

## D. Routing

1. Each surface changes the URL fragment (`#/vision`, `#/benchmarks`, and so on).
2. Reloading on a fragment restores that surface, not the assistant.
3. Browser Back and Forward move between visited surfaces.
4. A drilled-into surface (anything under Advanced) shows a Back button in its
   toolbar that returns to where you actually came from.
5. Editing the fragment in the address bar navigates.
6. An unknown fragment falls back to the assistant.

## E. Image and live camera

1. Open Image & Live. With no VLM loaded, controls are disabled and the engine
   notice explains why.
2. Load a VLM. Load an image from disk, or start the camera and capture a frame.
3. Describe the frame. Output streams in and Cancel stops it mid-stream.
4. Frame metadata and timing render after the first capture.

## F. Speech

Each of these needs the matching Sherpa model downloaded and loaded.

1. Transcribe: record from the microphone and confirm streaming partials, then
   a final transcript. Drop an audio file and confirm the batch path produces a
   transcript. Clear empties the output.
2. Read aloud: enter text, adjust the rate, press Speak, and confirm audio
   plays. Stop interrupts it mid-utterance.
3. Voice activity: start listening and confirm the speech pill flips between
   speech and silence, the confidence readout moves, and the event log fills.
4. Talk: run setup, start a session, speak, and confirm the transcript, the
   assistant response, and spoken output. Interrupt cuts the reply off.

## G. Documents

1. Pick an embedding model and an LLM. Download either from its row if missing.
2. Drop in a `.txt`, `.md`, or `.json` file. It appears in the list and indexes.
   Drop an unsupported extension and confirm it is rejected with a reason, not
   silently ignored: a drop bypasses the input's `accept` filter.
3. Ask a question. The answer streams and lists the retrieved sources.
4. "Clear all" empties the index. The index is session-only, so a reload clears
   it too. Confirm the UI says so rather than implying persistence.

## H. Solutions and benchmarks

1. Solutions lists the two packaged workflows, Voice agent and Document Q&A.
   Running one with its models present produces a result; running one without
   them fails with a readable per-solution message rather than a silent no-op.
   The per-solution recheck control re-probes engine availability.
2. Benchmarks runs one prompt at three token budgets (Short 50, Medium 256,
   Long 512) and charts time-to-first-token and tokens per second for each.
   With no model loaded, the run buttons are disabled and the view says to load
   one.

## I. Downloads and storage

1. The panel names the storage backend (private browser storage, or a chosen
   folder) and shows per-site usage against the quota.
2. "Choose Storage Folder" opens the directory picker. Cancelling is a no-op.
3. If a chosen folder lost permission, the re-authorize control restores access.
4. Delete removes a model immediately, with a toast and no confirmation prompt.
   Afterwards the model sheet shows it as not downloaded and usage drops.
5. "Clear Caches" also runs immediately, with a toast.
6. A paused or failed transfer offers Delete so partial bytes can be reclaimed,
   and an in-flight one offers Cancel.

## J. Settings

1. Temperature is a slider from 0 to 2 in steps of 0.1, defaulting to 0.7.
2. Max Tokens defaults to 10000 and steps by 500 between 500 and 20000. The
   minus and plus buttons disable at the bounds.
3. System Prompt and Thinking Mode render. Thinking Mode is off by default.
4. API Key is a password field, Base URL is a URL field. "Apply & Reinitialize"
   restarts the runtime; a bad endpoint reports the failure and restores the
   previous runtime rather than leaving the app broken.
5. The Hugging Face token field reports Configured or Not set, and Clear resets it.
6. Analytics is a read-only state row describing the SDK environment. It is not
   a toggle.
7. SDK Version matches the installed `@runanywhere/web`, and Documentation links
   to `https://docs.runanywhere.ai`.
8. Change a generation setting, reload, and confirm it persisted. Confirm the
   API key did not.

## K. Degraded and unavailable states

1. Segmentation and Diarization always render the unavailable placeholder, and
   the placeholder names the SDK verb each would call. No browser engine
   publishes those capabilities.
2. Block one WASM artifact in DevTools and reload. The affected engine reports
   as unavailable, the drawer footer reads "On-device engine unavailable", the
   picker gates exactly the rows that need it, and the rest of the app stays
   navigable. Retry recovers without a page reload once the block is lifted.
3. Serve the built bundle without COOP/COEP headers. The isolation service
   worker installs, reloads once, and the app comes up isolated. It does not
   reload in a loop.

## L. Theme and layout

1. The theme button toggles light and dark, and the choice survives a reload.
2. With no stored choice, the app follows the OS preference, including a change
   made while the tab is open.
3. At a 390px viewport the drawer is a scrim overlay, Escape closes it, and
   nothing overlaps the composer.

## M. Console audit

Collect every console error and network failure from the pass and classify each
as expected (a capability probe that legitimately fails on this browser) or a
real defect. Attach screenshots for anything that is not obviously one or the
other.
