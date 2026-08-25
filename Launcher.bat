@echo off
if exist "%~dp0Data\refresh_shortcut.ps1" (
  "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0Data\refresh_shortcut.ps1" -LauncherPath "%~f0" >nul 2>&1
)
if not exist "%~dp0Data\Turbo ffmpegger.hta" (
  echo Could not find Data\Turbo ffmpegger.hta next to this launcher.
  pause
  exit /b
)
start "" mshta.exe "%~dp0Data\Turbo ffmpegger.hta"
