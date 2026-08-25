param(
    [Parameter(Mandatory = $true)]
    [string] $LauncherPath
)

$launcherFullPath = [System.IO.Path]::GetFullPath($LauncherPath)
$rootPath = [System.IO.Path]::GetDirectoryName($launcherFullPath)
$shortcutPath = [System.IO.Path]::Combine($rootPath, 'Turbo ffmpegger.lnk')
$dataPath = [System.IO.Path]::Combine($rootPath, 'Data')
$iconPath = [System.IO.Path]::Combine($dataPath, 'Turbo ffmpegger.ico')

if (-not [System.IO.File]::Exists($launcherFullPath)) { exit 3 }
if (-not [System.IO.File]::Exists($iconPath)) { exit 4 }

$shortcut = $null
$shell = New-Object -ComObject WScript.Shell
try {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $launcherFullPath
    $shortcut.IconLocation = $iconPath + ',0'
    $shortcut.Description = 'Turbo ffmpegger'
    $shortcut.WindowStyle = 1
    $shortcut.Save()
}
finally {
    if ($null -ne $shortcut) {
        [void] [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut)
    }
    [void] [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
}
