# Add or update FFmpeg and FFprobe

**The conversion programs are not included.** Supply both programs before
converting or inspecting media. The interface and Voidbreaker can open without
them. Turbo ffmpegger does not download them or search your system PATH.

## Windows x64

1. Download a Windows x64 build using the links on the
   [official FFmpeg download page](https://ffmpeg.org/download.html).
2. Extract it. Find `ffmpeg.exe` and `ffprobe.exe`, usually in its `bin` folder.
3. Close Turbo ffmpegger and put both files in the following folder:

```text
Your extracted application/
  Turbo ffmpegger.exe
  App/
    resources/
      tools/
        ffmpeg.exe
        ffprobe.exe
```

Use both programs from the same build. A self-contained static build avoids
having to copy extra codec DLLs. If you choose a shared build, keep all its
required DLLs alongside the programs, plus its own license notices.

## Linux x64

Use a Linux x86-64 build from the same download page. Copy `ffmpeg` and
`ffprobe` to `App/resources/tools` in your extracted application. Linux file
names are case sensitive and have no `.exe` extension. From that application's
top-level folder, give the programs executable permission:

```sh
chmod u+x App/resources/tools/ffmpeg App/resources/tools/ffprobe
```

A suitable static build is simplest for portability. Copying executables out
of a distribution package may leave dependencies on shared libraries installed
on that computer. Keep any dependencies required by the build you choose.
`sh Help/Start.sh` also restores executable permissions for tools when present.

## Check your installation

Start the app, add a short video and inspect it, then try MP4 HQ (keep size).
That preset needs an FFmpeg build with the `libx264` encoder and AAC support.
Other presets may require additional encoders, filters, fonts or hardware.
An encoder/filter missing from your build cannot be enabled by the converter.

To check the installed programs directly, run from the application folder:

```powershell
# Windows PowerShell
& './App/resources/tools/ffmpeg.exe' -version
& './App/resources/tools/ffprobe.exe' -version
& './App/resources/tools/ffmpeg.exe' -encoders
& './App/resources/tools/ffmpeg.exe' -filters
```

```sh
# Linux terminal
./App/resources/tools/ffmpeg -version
./App/resources/tools/ffprobe -version
./App/resources/tools/ffmpeg -encoders
./App/resources/tools/ffmpeg -filters
```

## Upgrade FFmpeg yourself

Close the application, back up your existing tools folder, and replace both
programs with a matching pair for your operating system and architecture.
Update any required supporting libraries too. Test a short video with your
usual templates before relying on the new build. You do not need to recompile
Turbo ffmpegger for a compatible replacement.

New codecs and filters can be used in custom templates through their FFmpeg
arguments. New buttons or editor choices would require changes to the app UI;
they are not added automatically. Builds may also remove or change options.

## Application updates and moving computers

Always use `App/resources/tools` under the **original application folder**.
Updates installed under `Versions` continue to use those files and do not
replace them. Do not put tools in a version-specific folder.

For a manual app upgrade into a new folder, copy your existing `Data` folder
and your `App/resources/tools` folder across, with both apps closed. For a
move to another operating system, transfer Data but supply matching tools for
the new operating system. A complete same-platform folder copy includes them.

## Runtime libraries and distribution

`App/ffmpeg.dll` (Windows) and `App/libffmpeg.so` (Linux) belong to Electron's
interface runtime. They remain included and are covered by the notices in
Licenses. Do not remove or replace them with files from an FFmpeg CLI build.

The public packaging scripts exclude the FFmpeg/FFprobe conversion programs,
even if you have installed them locally. The repository ignore rules also
exclude their exact executable names. If you independently redistribute an
FFmpeg build, its own license and corresponding-source requirements apply;
the application Source folder is not the source for those external programs.
