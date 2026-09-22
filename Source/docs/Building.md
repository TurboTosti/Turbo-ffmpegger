# Turbo ffmpegger 1.0 alpha source

Public tag: **v1.0-alpha**. Canonical package version: **1.0.0-alpha**.

This is the complete application and Voidbreaker source. FFmpeg and FFprobe
conversion programs are external user-supplied dependencies and are never
copied by the public packaging script. Electron's required multimedia runtime
libraries remain in the platform packages, with their original license notices.

## Source layout

- `app/`: Electron host, conversion/update/storage modules, UI and game.
- `launcher/`: Windows/Linux native launcher source and prebuilt launchers.
- `game-source/`: original Voidbreaker source and its build instructions.
- `seed-data/`: clean presets/settings for new installations.
- `licenses/`: notices for dependencies supplied with the application.
- `docs/`: setup, publishing and build instructions.
- `tests/`, `previews/`, `Verification.json`: checks and recorded validation.

No conversion tools, Electron runtime archives, compiler installation, user
profile, game save or developer build cache is included in this source folder.
The small prebuilt native launchers are included for this exact app version;
their source and build metadata are next to them.

## Build the application packages

Use Node.js 22 or later. The application has no npm install step; JSNES and
fflate are vendored under app with their notices. For optional source tests,
install the parser dependency here with `npm install --no-save acorn@8.15.0`.

1. Obtain the **Electron 44.4.3** x64 archives for Windows and Linux from
   [Electron's release](https://github.com/electron/electron/releases/tag/v44.4.3).
   Extract their contents into `runtime/windows/` and `runtime/linux/`.
   Preserve the runtime LICENSE and LICENSES.chromium.html files.
2. For this exact app version, the included launcher/bin files are ready.
   To rebuild them, obtain **Zig 0.15.2**, set `TURBO_ZIG` to its executable,
   and run `node launcher/build.cjs`. The launcher build currently targets a
   Windows development host and cross-compiles the static Linux launcher.
3. Run `node package.cjs /absolute/path/to/a/new/output-folder` from this folder.
   Use a fresh output directory; existing release folders/ZIPs are not overwritten.

The package builder copies the runtime, app, clean seed settings and help files,
patches in the original icon, generates schema-2 checksum manifests and makes
the two platform ZIPs. It does not read package-inputs.json or any locally
installed FFmpeg/FFprobe files. A final assertion rejects conversion programs.

For a version change, update `app/package.json` and rebuild the launchers before
packaging. Generate fresh validation reports for the changed code; do not
present retained historical results as a test of your modifications.

## Run from source

Run Electron against `app/` with
`--portable-root=/absolute/path/to/a/writable/test-folder`.
Put your own conversion programs in that test folder's **App/resources/tools**.
The application always resolves tools from the original portable root, even
when a new app is running under Versions. See docs/FFmpeg-setup.md.

The native launchers only forward arguments to the runtime under App. Both
executables and the complete runtime folder are required. The root
resources/app/package.json version record and desktop-release.json manifest
must remain in place for updater compatibility.

## Background checks

Set `TURBO_TEST_TOOLS` to a directory containing a compatible pair of conversion
programs for your host. These are test inputs and are not added to a package.
On Windows, the historical default is the development workspace's harness;
external checkouts should always provide TURBO_TEST_TOOLS explicitly.

Run the following from this source folder:

```text
node tests/external-tools.cjs
node tests/core.cjs
node tests/simple-mode.cjs
node tests/versions.cjs
node tests/ui-source.cjs
node tests/packages.cjs /path/to/output-folder
node tests/release-layout.cjs /path/to/output-folder
node tests/executable.cjs /path/to/output-folder
```

The executable check uses Electron's Node mode, not an application window.
Run tests/packaged-runtime.cjs with the Windows Electron executable and
ELECTRON_RUN_AS_NODE=1 to check the packaged update worker without a GUI.
Synthetic video and temporary files stay below tests/. Linux executables have
been checked structurally but not run on a Linux desktop. See Verification.json
for current versus retained checks; actual desktop layout/drop testing remains
separate. A checkout without the previous release can skip historical byte
comparison in ui-source.cjs by not supplying that baseline folder.

## Update and release format

The updater uses published releases from TurboTosti/Turbo-ffmpegger. The tag
v1.0-alpha normalizes to package/manifest version 1.0.0-alpha. Publish higher
versions for subsequent releases, with matching rebuilt Windows/Linux x64
ZIPs. Drafts and equal/older versions are ignored. The Windows/Linux ZIPs must
contain exactly one schema-2 desktop-release.json with matching platform,
architecture, version and file checksums. Source assets are ignored.

Updates stage immutable app files under Versions in the original application
folder, leaving Data and the user's original App/resources/tools untouched.
For a manual upgrade, transfer Data and that tools folder yourself.

Use docs/Publishing.md for upload instructions. Do not include your external
conversion programs in source commits or release packages.
