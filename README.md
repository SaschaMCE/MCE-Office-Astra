# MCE Office 1.0.30 — smoother 3D rendering

**Windows-Download:** [MCE Office 1.0.30 als ZIP herunterladen](https://github.com/SaschaMCE/MCE-Office-Astra/archive/refs/heads/download-v1.0.30.zip).
Die ZIP-Datei mit **Alle extrahieren** entpacken, den entpackten Ordner öffnen
und **Start-MCE-Office-1.0.30.cmd** doppelt anklicken. Der Starter setzt die
enthaltenen Teile zusammen, prüft den SHA-256-Wert und startet die Anwendung.
Beim nächsten Mal kann die entstandene EXE direkt gestartet werden.

This project recovers the editable Electron files from the supplied MCE Office
1.0.28 portable executable. The original Angular TypeScript project was not in
that executable: `app/web/browser/main-T4VOFCRR.js` is the recovered JavaScript
bundle, formatted for inspection and modified directly. The existing floor plan,
41 areas, room controls, images, and third-party license notices are retained.

## Changes

- Where GPU timers are available, asynchronous measurements adjust the 3D
  resolution between 70% and 100% to leave headroom for 60 Hz rendering. Slow
  frames reduce pixel work; sustained spare capacity restores detail. Controls
  and text stay at native resolution. Warm-up, invalid measurements, bounded
  pending queries and separate recovery thresholds avoid stalls and oscillation.
- Dense static furniture is batched in 8-metre areas, allowing the renderer to
  skip geometry outside the camera view. Small batches stay combined to limit
  draw calls. No furniture or room geometry is removed.
- Ambient shading uses 16 samples instead of 24, with cached view depth and a
  half-resolution blur and four-tap depth-aware upsampler instead of nine
  repeated full-resolution depth reconstructions. Two-channel intermediate
  textures limit bandwidth while preserving soft shading.
  The offscreen scene uses 2× MSAA to reduce multisample memory bandwidth.
- Doors, the colleague, projector and exit indicators update once per frame;
  steering and collisions retain the short simulation steps.
- Hidden TV slides keep their timing without redrawing/uploading the canvas;
  live slide textures avoid repeated mipmap generation. Map positions update
  only while the map is displayed and immediately when it opens.
- Smooth mode releases the full-size shading targets; devices without float
  render-target support use the smaller pixel budget from the first frame.

The visual improvements introduced in 1.0.29 remain:

- Soft depth-based shading at furniture contacts and room corners, rendered at
  half resolution with a depth-aware filter; no additional scene geometry pass.
- Batched soft floor shadows, finer oak grain, subtle floor surface relief,
  balanced cool/warm lighting, and clearer glass.
- A persistent **Graphics: Detail / Smooth** control. Smooth bypasses ambient
  shading and reduces the pixel budget; unsupported floating-point render
  targets automatically use the direct renderer.
- Damped drag-to-look input, shorter movement simulation steps for consistent
  steering/collision checks across frame rates, and less camera bob.
- Clear input on focus loss and pointer cancellation; cap elapsed time on resume
  to avoid large jumps. The walking colleague now has animated arms, a carried
  mug, subtle body motion, and a floor shadow.

## Develop and test

Use the existing checkout; cloud tasks already have an isolated environment and
do not need an additional Git worktree.

Requires Node.js 22.12 or newer and Python 3 for Windows packaging.

```sh
npm ci
npm run dev
npm test
npm run profile
npm run build
```

The development server listens on port 4173. Tests start their own server on
4174, use system Chromium when available, and otherwise use Playwright's browser
(`npx playwright install chromium`). `CHROMIUM_PATH` can select another installed
Chromium. Test-only inspection hooks are injected by the test server and are
never included in the application archive. Reports and screenshots go to
`.artifacts/`.

The suite checks real WebGL rendering, input damping, movement at 30/60/120 Hz,
focus loss, large frame gaps, three room routes, projector/screen transitions,
partition transitions, the exit route, map controls, graphics modes, and resizing.
It also checks deferred TV updates and the visible scene's geometry/draw-call
budgets. Simulated sustained GPU overload, recovery and timing outliers verify
adaptive resolution, its bounds and unchanged UI dimensions.
`npm run profile -- <git-revision>` measures the previous bundle using
the same viewport, camera positions and synchronous pixel readback. Without a
revision it measures the working tree. Results are software-WebGL diagnostics,
not a frame-rate guarantee for a Windows laptop.

## Windows packages

```sh
npm run build
npm run package -- /path/to/MCE-Office-1.0.28-portable.exe
npm run download
```

The packaging script verifies the original executable's SHA-256, reuses its
launcher and Electron 44.7.0 Windows runtime, updates Electron's embedded ASAR
integrity record to match the modified archive, and writes a new unique launcher
cache key. Integrity enforcement is preserved. It validates the ZIP CRCs,
bounded archive stream, footer, ASAR contents, and hashes.

Outputs in `dist/`:

- `MCE-Office-1.0.30-portable.exe`: self-extracting Windows application.
- `MCE-Office-1.0.30-windows.zip`: unpack and run `MCE Office.exe`.
- `app.asar`: rebuilt application archive.
- `SHA256SUMS.txt`: package checksums.
- `download-1.0.30/`: files for the separate download branch, so users can obtain
  all parts as one GitHub ZIP. The included starter checks the complete EXE hash
  before launching; no download, administrator access or policy change is needed
  to assemble the package. No command files from outside this folder are run.

Validation in this cloud environment uses Linux Chromium with software WebGL.
It verifies application behavior and packaging structure, not native Windows
launch or performance on an office computer's GPU. Native Windows smoke testing
is still required. Fixed-resolution software-renderer timings did not establish
a speedup; the reduced geometry workload and adaptive resolution should not be
presented as measured Windows FPS. No GitHub release is published by these scripts.
