# pick_files.ps1 — multi-select file open dialog, writes chosen paths to a temp file
param([string]$OutFile)

Add-Type -AssemblyName System.Windows.Forms

$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title       = "Select video, audio or image files"
$dlg.Filter      = "All supported|*.mp4;*.mov;*.mkv;*.avi;*.webm;*.wmv;*.mxf;*.m4v;*.flv;*.mp3;*.aac;*.wav;*.flac;*.m4a;*.ogg;*.opus;*.png;*.jpg;*.jpeg;*.bmp;*.tga;*.tif;*.tiff;*.dpx;*.exr|Video & Audio|*.mp4;*.mov;*.mkv;*.avi;*.webm;*.wmv;*.mxf;*.m4v;*.flv;*.mp3;*.aac;*.wav;*.flac;*.m4a;*.ogg;*.opus|Image sequences|*.png;*.jpg;*.jpeg;*.bmp;*.tga;*.tif;*.tiff;*.dpx;*.exr|All files|*.*"
$dlg.FilterIndex = 1
$dlg.Multiselect = $true

$result = $dlg.ShowDialog()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    # Default encoding = ANSI, no BOM, so the HTA's ASCII reader gets clean paths.
    ($dlg.FileNames -join "`r`n") | Out-File -FilePath $OutFile -Encoding Default
} else {
    "" | Out-File -FilePath $OutFile -Encoding Default
}
