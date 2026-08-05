# FFmpeg Batch — Portable

No installation required. Works on any Windows PC.

---

## Setup

1. Drop `ffmpeg.exe` and `ffprobe.exe` into the data folder (next to the .hta file)
   - Download: https://www.gyan.dev/ffmpeg/builds/
   - Get "ffmpeg-release-essentials.zip", extract, find ffmpeg.exe and ffprobe.exe in the bin\ folder

2. Double-click the launcher.bat or **FFmpeg Batch.hta** — that's it

---

## Usage

1. Pick a **preset** from the left panel
2. **Drag & drop** video files onto the drop zone (or click Browse)
3. Optionally set a custom **output folder** — otherwise files go into an `output\` subfolder next to each input
4. Click  "Convert"

---

## Adding your own presets

Open `presets.json` in Notepad (or click "Edit presets.json" in the app).

Each entry looks like:

```json
{
  "id":          "unique-id",
  "name":        "Name shown in the list",
  "description": "Short description",
  "outputExt":   "mp4",
  "args":        "-c:v libx264 -preset veryfast -crf 18 -c:a aac -b:a 128k"
}
```

The `args` field is copied directly from your .bat files — just remove the
`-i "input"` and the output filename, keep everything in between.

Click **↺ Reload presets** in the app to pick up changes without restarting.

---

## Folder contents

```
FFmpeg Batch.hta   ← double-click to launch
presets.json       ← edit to add/change conversion presets
ffmpeg.exe         ← drop here (download separately, see above)
README.txt         ← this file
```

---

## Smart format filtering

When you add files, the preset list automatically narrows to formats
compatible with what you dropped (e.g. an MP4 shows MP4 presets plus GIF,
audio, ProRes, etc.). Toggle "Compatible only" in the left panel off to see
every preset regardless of input.

## Custom templates

- Click the pencil (edit) icon on any preset to open the editor. Adjust the
  name, input/output format, resolution, compression (CRF), encode speed,
  codecs and audio bitrate, then "Save as custom template".
- Custom templates appear under the "Custom" group with edit and delete (x)
  buttons. They are stored in custom_presets.json next to the app.
- Use "+ New custom template" in the Custom group to build one from scratch.


---

## Image sequences

To turn a numbered image sequence (e.g. frame_0001.png, frame_0002.png, ...)
into a video:

1. Pick an "Image Sequence -> ..." preset from the list.
2. Drag in (or Browse to) ANY single frame from the sequence.
3. The app auto-detects the filename pattern, the start number and how many
   consecutive frames exist in that folder, and shows it as one job
   (e.g. "frame_####.png  (1853 frames from 3680)").
4. Click Convert. The whole sequence is stitched into one video.

Works with padded (frame_0001) and non-padded (img1, img2 ...) numbering, and
with png/jpg/bmp/tga/tif/dpx/exr/webp. Frame rate is set by the preset (30 or
60 fps); duplicate a preset and edit its FPS field for other rates.
