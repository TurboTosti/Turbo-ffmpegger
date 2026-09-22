# Turbo ffmpegger

> **Upgrading from a version older than 1.0, such as 0.8 alpha? Please download the new version manually from [GitHub Releases](https://github.com/TurboTosti/Turbo-ffmpegger/releases).** The old updater may report success without actually installing the new desktop application. Extract the download into a new folder, keep your old folder as a backup, and follow the [manual upgrade instructions](#manual-upgrade) below to transfer your templates and settings.

**Portable video conversion for Windows and Linux — with templates, a Simple mode, and Voidbreaker to play while you wait.**

Turbo ffmpegger puts FFmpeg behind a desktop interface. Drop in your media, choose a template, and convert. Keep your custom templates, preferences and game progress together in one portable folder.

**Current version: 1.0 alpha** · Package version: `1.0.0-alpha` · Release tag: `v1.0-alpha`

**FFmpeg and FFprobe conversion programs are not included.** Download your own matching pair and place them in `App/resources/tools` inside the extracted application folder. See the setup steps below. The interface and game can open without them.

This continues the **0.8 alpha** release line. It is still an alpha: feedback and bug reports are welcome. The Linux package has been checked structurally, but has not yet been tested on a Linux desktop.

[Downloads and releases](https://github.com/TurboTosti/Turbo-ffmpegger/releases) · [Report an issue](https://github.com/TurboTosti/Turbo-ffmpegger/issues)

## Features

- **48 built-in templates**, plus custom templates you can create, edit, duplicate and delete.
- **Simple mode:** drop one video, press **do the thing**, and save the result beside the original.
- **Conversion queue** with progress, cancellation, media inspection and conversion logs.
- **Convert again:** finished, stopped and failed videos remain selectable so you can apply another template and retry.
- **Video, audio and image-sequence conversion** using your own FFmpeg and FFprobe programs in the portable tools folder.
- **Template search, favourites and compatibility filtering** in the permanent sidebar.
- **Five interface languages:** English, Nederlands, 日本語, 中文 and 한국어.
- **Colour themes and optional animated backgrounds:** Ambient, Futuristic, Waves, Magic, Starfield and Aurora.
- **Voidbreaker:** a built-in NES game with sound, saved progress and an adjustable CRT filter.
- **Portable settings and templates**, plus optional updates checked from inside the app.

## What’s new in 1.0 alpha

- Simple mode is centered and matches the other popups, with a brief opening and closing animation. Reduced-motion preferences are respected.
- The top menu contains **Manage templates**, **Simple mode** and **Settings**.
- Manage templates has its own popup. The redundant full-library shortcut has been removed.
- Language and Updates are inside Settings. Templates are managed separately.

This version also includes the previous alpha’s background settings saves: rapid changes are combined, temporary Windows file locks are retried, and pending settings are saved before the application closes.

## Download and run

Choose the matching archive from the [Releases page](https://github.com/TurboTosti/Turbo-ffmpegger/releases):

| Download | Purpose |
| --- | --- |
| `Turbo-ffmpegger-1.0.0-alpha-Windows-x64.zip` | Windows 10/11, 64-bit Intel/AMD |
| `Turbo-ffmpegger-1.0.0-alpha-Linux-x64.zip` | Linux desktop, 64-bit Intel/AMD |
| Repository `Source/` folder | Application source, build instructions and verification reports |

### Windows

1. Extract the **entire ZIP** into a folder you can write to.
2. Download a Windows x64 build using the links on the [official FFmpeg download page](https://ffmpeg.org/download.html). Extract **ffmpeg.exe** and **ffprobe.exe** from its `bin` folder into **App/resources/tools**. Use both programs from the same build; a static build is simplest because it avoids extra codec DLLs.
3. Open **Turbo ffmpegger.exe** in the top-level folder.

No installer or separate Node.js, .NET or WebView2 installation is needed. FFmpeg and FFprobe must be supplied as above; the app does not download them or search PATH.

```text
Your extracted application/
  Turbo ffmpegger.exe
  App/
    resources/
      tools/
        ffmpeg.exe      <- add your copy
        ffprobe.exe     <- add your copy
```

The top-level executable is a small launcher. It starts the actual application inside **App**, where its supporting files live. Keep both executables and all their folders together.

### Linux

1. Extract the **entire Linux ZIP** into a writable folder.
2. Download a Linux x86-64 build from the [FFmpeg download page](https://ffmpeg.org/download.html). Put both **ffmpeg** and **ffprobe** in **App/resources/tools**. A compatible static build is simplest; shared builds also need their supporting libraries.
3. Open a terminal in the extracted folder and run:

```sh
chmod u+x App/resources/tools/ffmpeg App/resources/tools/ffprobe
./turbo-ffmpegger
```

If your extractor did not preserve executable permissions, use the included helper:

```sh
sh Help/Start.sh
```

The helper restores executable permissions for the app and any supplied conversion programs, then starts the app. Missing conversion programs do not prevent the interface from opening.

Linux executables commonly have no extension. This download is a portable application folder, rather than a `.deb`, RPM or Arch package. It includes its application runtime; you supply the conversion tools. It still requires normal Linux desktop libraries and working Chromium sandbox support. Compatibility with individual distributions is not yet verified. ARM and 32-bit systems are not covered by these downloads.

The separate `App/ffmpeg.dll` on Windows and `App/libffmpeg.so` on Linux belong to Electron and remain included. Leave those runtime libraries in place. They are not substitutes for the conversion programs.

### Updating FFmpeg yourself

Close the app and back up `App/resources/tools`. Replace both conversion programs with a matching pair for your operating system and architecture, including any supporting libraries that build needs. Try a short conversion with your usual templates. MP4 HQ requires `libx264` and AAC support. New codecs and filters can be used through custom template arguments; interface controls do not change automatically.

Built-in application updates continue using `App/resources/tools` in the **original portable folder**, even while running a newer app from `Versions`. Your supplied tools are not replaced. For complete setup, command examples and troubleshooting, see `Help/FFmpeg-setup.md` in the download or [the repository guide](Docs/FFmpeg-setup.md).

## Converting media

### Simple mode

1. Select a template in the main window, or leave the default **MP4 HQ (keep size)** selected.
2. Open **Simple mode**. It remembers the template selected at that moment.
3. Drop one video into the popup, or click the drop area to choose it.
4. Press **do the thing**.

The progress bar shows the conversion status. The result is saved beside the original:

```text
holiday.mov
holiday_converted.mp4
```

The selected template determines the output format. If that filename already exists, the next result gets a numbered suffix, such as `holiday_converted_1.mp4`.

Close the popup with **×** or **Escape** to return to the main interface. An active conversion continues in the queue, where you can stop it. You can select another video or convert again when the current conversion ends.

### Full interface

1. Drop media into the main window or use **Browse files**.
2. Choose a template from the sidebar and apply it to the desired videos.
3. Choose an output folder if needed, then press **Convert**.

The default output location is an `output` subfolder beside the input. Existing output files are protected with numbered filenames.

Finished, stopped and failed rows remain available. Select them, choose another template, and convert again from the original media.

Use **Manage templates** to create custom templates, edit or duplicate a selected template, delete saved custom templates, open the preset file or reload presets. Sidebar search, favourites and compatibility filters help you find a template.

## Portable data and upgrades

Your personal data lives in **Data**, beside the launcher:

| File | Contents |
| --- | --- |
| `Data/custom_presets.json` | Custom templates |
| `Data/presets.json` | Built-in template library and saved edits |
| `Data/settings.json` | Favourites, language and appearance |
| `Data/game-options.json` | CRT and volume preferences |
| `Data/Game/voidbreaker-state.json` | Saved Voidbreaker progress |

To move between computers using the same operating system, close the app and copy the **whole application folder**, including Data and Versions if present.

To move between Windows and Linux, download the matching platform build and copy your existing **Data** folder into it with both apps closed. Media files are separate. Templates that reference specific fonts, file paths or hardware encoders may need adjustment on the new computer.

### Manual upgrade

1. Close the old application.
2. Extract the new release into a **new folder**.
3. Copy your existing **Data** folder into the new folder, replacing the new release’s starter Data files.
4. Copy your **App/resources/tools** folder into the same location in the new application. When changing operating systems, supply the matching platform's tools instead.
5. Open the new version and keep the old folder as a backup until you have checked it.

Avoid extracting a release over an existing application folder. Never replace your saved Data with the starter files from a fresh download.

For older versions, use the manual upgrade procedure. If templates are missing, open **Settings → Import previous settings folder…** and select the folder containing the old template/settings JSON files.

### Built-in updates

Open **Settings → Updates → Check for updates**. Checks happen when requested; updates are not installed automatically.

An update must have a strictly newer version and a compatible desktop package for your platform. Alpha releases can receive newer alpha, beta, RC and stable releases. Older, equal and draft releases are ignored.

Downloaded packages are checked against their manifest and file hashes. The app prepares the update under **Versions** and switches to it when you choose **Restart with update**. Your existing Data folder and original tools folder are retained. Finish or stop any conversion before restarting.

## Play while waiting: Voidbreaker

Open **Play while waiting** to launch Voidbreaker. The game and the open-source JSNES emulator are bundled: no ROM selection or emulator configuration is needed.

| Action | Control |
| --- | --- |
| Move | Arrow keys; A / D for left / right |
| NES A / B | Z or Space / X |
| Start / Select | Enter / Shift |
| Pause or resume | P or the Pause/Resume button |
| Close the game | Escape or Stop & close |

Pause and **Stop & close** save your progress. Press Play again to continue. Closing the application also saves progress, so you can resume after reopening it. Losing focus pauses the game, and **Reset** starts a new game after confirmation.

Volume and CRT strength are adjustable. The CRT effect includes scanlines, curvature and a phosphor-style mask; it falls back to a plain picture if graphics acceleration is unavailable. The emulator stops simulating while paused and reduces screen updates during conversion. Playing can still use CPU/GPU resources.

## Troubleshooting and testing status

- **FFmpeg/FFprobe missing:** add both programs to `App/resources/tools` in the original portable folder. Keep their original names; Linux programs need executable permission. Missing codecs or filters require a build that includes them.
- **Settings cannot be saved:** make sure the application folder is writable. Temporary locks are retried. If a save still fails, the previous file is preserved and the app displays a notice. A failed settings save during closing keeps the app open so you can retry.
- **A file will not drop:** try Browse files and confirm the file is local and fully downloaded. Run the application as your normal user.
- **Windows shows a warning:** this build is unsigned, so Windows may display a SmartScreen or publisher warning.
- **Need diagnostic details:** application logs are under `Data/Logs`; conversion details are available in the queue.

Background checks cover conversion, safe output naming, template portability, queue reuse, popup navigation, settings-save recovery, game persistence and update/package validation. **Actual popup appearance, physical drag-and-drop and Linux desktop execution still need broader testing.** The download includes `Help/Verification.json`, which distinguishes current checks from retained earlier results.

When [reporting an issue](https://github.com/TurboTosti/Turbo-ffmpegger/issues), include your operating system, application version, what you were doing and the relevant error or conversion log.

## Credits

Built with Electron, JSNES and fflate, and designed to run user-supplied FFmpeg/FFprobe conversion programs. Electron's own multimedia libraries remain bundled. Third-party license notices and component attribution are included in the portable package’s **Licenses** folder.

The repository's **Source** folder contains the application source, Voidbreaker source, build instructions and verification reports. It does not include the external conversion programs or their source. See [Source/README.md](Source/README.md) for development setup.

