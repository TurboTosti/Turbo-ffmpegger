Turbo ffmpegger - Portable
Version 0.5

No installation is required. Turbo ffmpegger uses the Windows PowerShell and
.NET components that are included with Windows.

SETUP

1. Keep the Data folder together with Launcher.bat.
2. Keep ffmpeg.exe and ffprobe.exe in Data, next to Turbo ffmpegger.hta.
3. Double-click Launcher.bat.

If ffmpeg.exe or ffprobe.exe is missing, download an FFmpeg Windows build and
place both files in Data. One source is:
https://www.gyan.dev/ffmpeg/builds/

ADDING INPUT FILES

You can add video, audio and supported image files in any of these ways:

- Drag files from File Explorer onto the drop zone.
- Drag a COMPLETED download from Chrome's or Firefox's Downloads list onto the
  drop zone.
- Click Browse files and select one or more files.

A browser download must be finished and the downloaded file must still exist
on disk. Turbo ffmpegger does not download web links.

Run Turbo ffmpegger and the browser at the same Windows privilege level.
Normally this means running both normally, not "as administrator". Windows
blocks drag-and-drop from a normal browser into an elevated application.

USAGE

1. Pick a preset in the left panel.
2. Add one or more input files.
3. Optionally choose an output folder. Otherwise output is written to an
   output subfolder next to each input file.
4. Click Convert.

DOWNLOAD SECURITY / UNBLOCKING

If Windows refuses to open the portable app, right-click the downloaded ZIP
before extracting it, choose Properties, tick Unblock, and then extract again.
If it was already extracted, unblock the files in the extracted folder.

NATIVE DROP RECEIVER

drop_receiver.ps1 is the small local helper that enables reliable Explorer,
Chrome and Firefox drops. It:

- accepts only existing local files supplied by the Windows drop operation;
- never downloads URLs and never contacts the network;
- runs hidden only while Turbo ffmpegger is open;
- uses a private temporary queue and removes it when the app closes.

If the drop helper cannot start, Browse continues to work and the drop-zone
subtitle reports that the helper is unavailable.

FOLDER CONTENTS

Launcher.bat                         starts the app
Data\Turbo ffmpegger.hta             main application
Data\Turbo ffmpegger.ico             application window/taskbar icon
Data\drop_receiver.ps1               native Explorer/browser drop support
Data\pick_files.ps1                  multi-file Browse dialog
Data\pick_folder.ps1                 output-folder dialog
Data\presets.json                    built-in conversion presets
Data\custom_presets.json             your custom presets
Data\settings.json                   saved appearance/settings, if present
Data\ffmpeg.exe                      converter
Data\ffprobe.exe                     media information reader

CUSTOM PRESETS

Use "+ New custom template", the pencil button on a preset, or open
presets.json. custom_presets.json stores templates made in the app. Use
"Reload presets" after editing JSON outside the app.

The preset args field is passed to FFmpeg between the input and output paths.
Only use arguments you trust.

IMAGE SEQUENCES

To convert a numbered image sequence such as frame_0001.png:

1. Pick an "Image Sequence -> ..." preset.
2. Add any one frame from the sequence.
3. Turbo ffmpegger detects consecutive frames and queues them as one job.
4. Click Convert.

Supported sequence formats include png, jpg, bmp, tga, tif, dpx, exr and webp.
