# MCE Office 1.0.29 — graphics update

This project recovers the editable Electron files from the supplied MCE Office
1.0.28 portable executable. The original Angular TypeScript project was not in
that executable: `app/web/browser/main-T4VOFCRR.js` is the recovered JavaScript
bundle, formatted for inspection and modified directly. The existing floor plan,
41 areas, room controls, images, and third-party license notices are retained.

## Changes

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

## Windows packages

```sh
npm run build
npm run package -- /path/to/MCE-Office-1.0.28-portable.exe
```

The packaging script verifies the original executable's SHA-256, reuses its
launcher and Electron 44.7.0 Windows runtime, updates Electron's embedded ASAR
integrity record to match the modified archive, and writes a new unique launcher
cache key. Integrity enforcement is preserved. It validates the ZIP CRCs,
bounded archive stream, footer, ASAR contents, and hashes.

Outputs in `dist/`:

- `MCE-Office-1.0.29-portable.exe`: self-extracting Windows application.
- `MCE-Office-1.0.29-windows.zip`: unpack and run `MCE Office.exe`.
- `app.asar`: rebuilt application archive.
- `SHA256SUMS.txt`: package checksums.

Validation in this cloud environment uses Linux Chromium with software WebGL.
It verifies application behavior and packaging structure, not native Windows
launch or performance on an office computer's GPU. Native Windows smoke testing
is still required. No GitHub release is published by these scripts.
