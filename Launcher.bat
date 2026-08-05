@echo off
if not exist "%~dp0Data\Turbo ffmpegger.hta" (
  echo Could not find Data\Turbo ffmpegger.hta next to this launcher.
  pause
  exit /b
)
start "" mshta.exe "%~dp0Data\Turbo ffmpegger.hta"