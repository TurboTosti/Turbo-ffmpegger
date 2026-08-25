# Native file-drop bridge for Turbo ffmpegger.
#
# MSHTML/HTA running in IE9 mode cannot reliably expose CF_HDROP paths to
# JavaScript. Chrome, Firefox and File Explorer all publish completed/local
# files through CF_HDROP, so this tiny transparent WinForms window receives the
# native drop and forwards verified paths to the HTA through per-drop queue
# files. It requires no installation and runs only while the parent HTA exists.

param(
    [Parameter(Mandatory = $true)]
    [string]$SessionDir,

    [switch]$SelfTest,
    [string]$SelfTestFile
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Write-BridgeError([string]$Message) {
    try {
        if (-not [System.IO.Directory]::Exists($SessionDir)) {
            [System.IO.Directory]::CreateDirectory($SessionDir) | Out-Null
        }
        [System.IO.File]::WriteAllText(
            (Join-Path $SessionDir "error.txt"),
            $Message,
            [System.Text.Encoding]::Unicode
        )
    } catch {
        # There is nowhere else to report a hidden helper error.
    }
}

function Write-BridgeState([string]$State) {
    try {
        [System.IO.File]::WriteAllText(
            (Join-Path $SessionDir "state.txt"),
            $State,
            [System.Text.Encoding]::ASCII
        )
    } catch {
        # State is cosmetic; a failed update must not break file drops.
    }
}

function Write-DropBatch([string[]]$Paths) {
    $verified = New-Object System.Collections.Generic.List[string]
    foreach ($path in $Paths) {
        if ($path -and [System.IO.File]::Exists($path)) {
            $verified.Add([System.IO.Path]::GetFullPath($path))
        }
    }
    if ($verified.Count -eq 0) { return $false }

    $id = "{0}_{1}" -f [DateTime]::UtcNow.Ticks, [Guid]::NewGuid().ToString("N")
    $temporary = Join-Path $SessionDir ("drop_" + $id + ".tmp")
    $completed = Join-Path $SessionDir ("drop_" + $id + ".drop")

    # UTF-16 preserves every Windows filename. Rename within the same folder so
    # the HTA never observes a partially written queue file.
    [System.IO.File]::WriteAllLines(
        $temporary,
        $verified.ToArray(),
        [System.Text.Encoding]::Unicode
    )
    [System.IO.File]::Move($temporary, $completed)
    return $true
}

function Convert-DropDataToText([object]$Value, [string]$Format) {
    if ($null -eq $Value) { return "" }
    if ($Value -is [string]) { return [string]$Value }

    [byte[]]$bytes = $null
    if ($Value -is [byte[]]) {
        $bytes = [byte[]]$Value
    } elseif ($Value -is [System.IO.MemoryStream]) {
        $bytes = ([System.IO.MemoryStream]$Value).ToArray()
    } elseif ($Value -is [System.IO.Stream]) {
        $copy = New-Object System.IO.MemoryStream
        try {
            $oldPosition = $null
            if ($Value.CanSeek) {
                $oldPosition = $Value.Position
                $Value.Position = 0
            }
            $Value.CopyTo($copy)
            $bytes = $copy.ToArray()
            if ($null -ne $oldPosition) { $Value.Position = $oldPosition }
        } finally {
            $copy.Dispose()
        }
    } else {
        return [string]$Value
    }

    if ($null -eq $bytes -or $bytes.Length -eq 0) { return "" }
    $encoding = [System.Text.Encoding]::UTF8
    if (($Format -match "W$") -or ($Format -eq "UnicodeText") -or
        ($bytes.Length -gt 1 -and $bytes[1] -eq 0)) {
        $encoding = [System.Text.Encoding]::Unicode
    }
    return $encoding.GetString($bytes).Trim([char]0).TrimStart([char]0xFEFF)
}

function Get-DroppedPaths([object]$Data) {
    $paths = New-Object System.Collections.Generic.List[string]
    $seen = @{}

    try {
        if ($Data.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop, $false)) {
            [string[]]$fileDrop = $Data.GetData([System.Windows.Forms.DataFormats]::FileDrop, $false)
            foreach ($path in $fileDrop) {
                if ($path -and [System.IO.File]::Exists($path)) {
                    $full = [System.IO.Path]::GetFullPath($path)
                    if (-not $seen.ContainsKey($full)) {
                        $seen[$full] = $true
                        $paths.Add($full)
                    }
                }
            }
        }
    } catch {
        # Continue with strict local-URI formats.
    }

    # A genuine native FileDrop is authoritative. Do not merge secondary text
    # formats from the same payload, because they could name an unrelated file.
    if ($paths.Count -gt 0) {
        return $paths.ToArray()
    }

    # Some Firefox/Chromium builds additionally publish the completed file as a
    # file: URI. Never accept http(s) URLs or try to download anything here.
    $formats = @(
        "UniformResourceLocatorW",
        "UniformResourceLocator",
        "text/x-moz-url",
        "text/uri-list",
        "UnicodeText",
        "Text"
    )
    foreach ($format in $formats) {
        try {
            if (-not $Data.GetDataPresent($format, $false)) { continue }
            $raw = Convert-DropDataToText ($Data.GetData($format, $false)) $format
            foreach ($candidateRaw in ($raw -split "[\x00\r\n]+")) {
                $candidate = $candidateRaw.Trim().TrimStart([char]0xFEFF).Trim([char]34)
                if (-not $candidate -or $candidate.StartsWith("#")) { continue }

                $local = ""
                $uri = $null
                if ([System.Uri]::TryCreate($candidate, [System.UriKind]::Absolute, [ref]$uri) -and
                    $uri.IsFile) {
                    $local = $uri.LocalPath
                }
                if ($local -and [System.IO.File]::Exists($local)) {
                    $full = [System.IO.Path]::GetFullPath($local)
                    if (-not $seen.ContainsKey($full)) {
                        $seen[$full] = $true
                        $paths.Add($full)
                    }
                }
            }
        } catch {
            # Unsupported clipboard formats are normal; try the next one.
        }
    }
    return $paths.ToArray()
}

function Remove-BridgeSession {
    try {
        $full = [System.IO.Path]::GetFullPath($SessionDir).TrimEnd([char]92)
        $temp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd([char]92)
        if ([System.IO.Path]::GetDirectoryName($full) -ne $temp) { return }
        if (-not [System.IO.Path]::GetFileName($full).StartsWith("TurboFfmpeggerDrop_")) { return }
        if (-not [System.IO.Directory]::Exists($full)) { return }
        if (([System.IO.File]::GetAttributes($full) -band
             [System.IO.FileAttributes]::ReparsePoint) -ne 0) { return }
        foreach ($file in [System.IO.Directory]::GetFiles($full)) {
            $name = [System.IO.Path]::GetFileName($file)
            if ($name -match '^(ready|geometry|state|stop|error)\.txt$' -or
                $name -match '^drop_[A-Za-z0-9_-]+\.(tmp|drop)$') {
                [System.IO.File]::Delete($file)
            }
        }
        if ([System.IO.Directory]::GetDirectories($full).Length -eq 0 -and
            [System.IO.Directory]::GetFiles($full).Length -eq 0) {
            [System.IO.Directory]::Delete($full, $false)
        }
    } catch {
        # A stale, tiny session folder is safer than broad cleanup.
    }
}

try {
    if (-not [System.IO.Directory]::Exists($SessionDir)) {
        [System.IO.Directory]::CreateDirectory($SessionDir) | Out-Null
    }

    Add-Type -AssemblyName System.Windows.Forms

    if ($SelfTest) {
        if (-not $SelfTestFile -or -not [System.IO.File]::Exists($SelfTestFile)) {
            throw "Self-test input file does not exist."
        }
        $selfTestData = New-Object System.Windows.Forms.DataObject
        $selfTestData.SetData(
            [System.Windows.Forms.DataFormats]::FileDrop,
            $false,
            [string[]]@($SelfTestFile)
        )
        $selfTestData.SetData(
            "text/uri-list",
            $false,
            (New-Object System.Uri($SelfTestFile)).AbsoluteUri
        )
        [string[]]$selfTestPaths = Get-DroppedPaths $selfTestData
        if ($selfTestPaths.Count -ne 1 -or
            $selfTestPaths[0] -cne [System.IO.Path]::GetFullPath($SelfTestFile)) {
            throw "Self-test could not read the native file-drop formats."
        }
        if (-not (Write-DropBatch $selfTestPaths)) {
            throw "Self-test could not create a drop batch."
        }
        [System.IO.File]::WriteAllText(
            (Join-Path $SessionDir "ready.txt"),
            "self-test",
            [System.Text.Encoding]::ASCII
        )
        exit 0
    }

    Add-Type -AssemblyName System.Drawing

    Add-Type -Language CSharp -ReferencedAssemblies @(
        "System.Windows.Forms",
        "System.Drawing"
    ) -TypeDefinition @"
using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public sealed class TurboDropOverlay : Form
{
    private const int WS_EX_NOACTIVATE = 0x08000000;
    private const int WS_EX_TOOLWINDOW  = 0x00000080;

    protected override CreateParams CreateParams
    {
        get
        {
            CreateParams cp = base.CreateParams;
            cp.ExStyle |= WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW;
            return cp;
        }
    }

    protected override bool ShowWithoutActivation
    {
        get { return true; }
    }

    public void SetBrowseHole(int width, int height,
                              int x, int y, int holeWidth, int holeHeight)
    {
        if (width < 1 || height < 1) return;

        Region next = new Region(new Rectangle(0, 0, width, height));
        if (holeWidth > 0 && holeHeight > 0)
        {
            // A small margin ensures the native overlay never steals the real
            // HTML Browse button's border or click target.
            int margin = 3;
            next.Exclude(new Rectangle(
                Math.Max(0, x - margin),
                Math.Max(0, y - margin),
                holeWidth + margin * 2,
                holeHeight + margin * 2));
        }

        Region old = Region;
        Region = next;
        if (old != null) old.Dispose();
    }
}

public static class TurboDropNative
{
    private const int GWL_HWNDPARENT = -8;
    private const uint SWP_NOZORDER = 0x0004;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint TH32CS_SNAPPROCESS = 0x00000002;
    private delegate bool EnumWindowsProc(IntPtr window, IntPtr parameter);

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct PROCESSENTRY32
    {
        public uint dwSize;
        public uint cntUsage;
        public uint th32ProcessID;
        public IntPtr th32DefaultHeapID;
        public uint th32ModuleID;
        public uint cntThreads;
        public uint th32ParentProcessID;
        public int pcPriClassBase;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string szExeFile;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool GetClientRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr insertAfter,
        int x, int y, int width, int height, uint flags);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongW", SetLastError = true)]
    private static extern int SetWindowLong32(IntPtr hWnd, int index, int value);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
    private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int index, IntPtr value);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool Process32FirstW(IntPtr snapshot, ref PROCESSENTRY32 entry);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool Process32NextW(IntPtr snapshot, ref PROCESSENTRY32 entry);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    public static int GetParentProcessId(int processId)
    {
        IntPtr snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (snapshot == new IntPtr(-1))
            throw new InvalidOperationException("Could not inspect the helper process.");
        try
        {
            PROCESSENTRY32 entry = new PROCESSENTRY32();
            entry.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));
            if (Process32FirstW(snapshot, ref entry))
            {
                do
                {
                    if (entry.th32ProcessID == (uint)processId)
                        return (int)entry.th32ParentProcessID;
                }
                while (Process32NextW(snapshot, ref entry));
            }
        }
        finally
        {
            CloseHandle(snapshot);
        }
        return 0;
    }

    public static IntPtr FindLargestVisibleWindowForProcess(int processId)
    {
        IntPtr best = IntPtr.Zero;
        long bestArea = 0;
        EnumWindows(delegate(IntPtr window, IntPtr parameter)
        {
            uint ownerProcessId;
            GetWindowThreadProcessId(window, out ownerProcessId);
            if (ownerProcessId != (uint)processId || !IsWindowVisible(window))
                return true;

            RECT rect;
            if (!GetClientRect(window, out rect))
                return true;
            int width = rect.Right - rect.Left;
            int height = rect.Bottom - rect.Top;
            if (width <= 0 || height <= 0)
                return true;

            long area = (long)width * (long)height;
            if (area > bestArea)
            {
                bestArea = area;
                best = window;
            }
            return true;
        }, IntPtr.Zero);
        return best;
    }

    public static void SetOwner(IntPtr overlay, IntPtr owner)
    {
        if (IntPtr.Size == 8)
            SetWindowLongPtr64(overlay, GWL_HWNDPARENT, owner);
        else
            SetWindowLong32(overlay, GWL_HWNDPARENT, owner.ToInt32());
    }

    public static Point GetClientOrigin(IntPtr owner)
    {
        POINT point = new POINT();
        point.X = 0;
        point.Y = 0;
        if (!ClientToScreen(owner, ref point))
            throw new InvalidOperationException("Could not locate the HTA client area.");
        return new Point(point.X, point.Y);
    }

    public static Size GetClientSize(IntPtr owner)
    {
        RECT rect;
        if (!GetClientRect(owner, out rect))
            throw new InvalidOperationException("Could not measure the HTA client area.");
        return new Size(Math.Max(1, rect.Right - rect.Left),
                        Math.Max(1, rect.Bottom - rect.Top));
    }

    public static void Place(IntPtr overlay, int x, int y, int width, int height)
    {
        SetWindowPos(overlay, IntPtr.Zero, x, y, width, height,
            SWP_NOZORDER | SWP_NOACTIVATE);
    }
}
"@

    # WScript.Shell launches powershell.exe directly, making the HTA's mshta.exe
    # process our parent. Read that relationship through the Win32 process
    # snapshot API; this needs no WMI service or administrator access.
    $parentId = [TurboDropNative]::GetParentProcessId($PID)
    if ($parentId -le 0) { throw "Could not identify the parent HTA process." }

    $hostHandle = [IntPtr]::Zero
    $deadline = [DateTime]::UtcNow.AddSeconds(8)
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            [System.Diagnostics.Process]::GetProcessById($parentId) | Out-Null
        } catch {
            throw "The parent HTA process exited before drag-and-drop started."
        }
        $hostHandle = [TurboDropNative]::FindLargestVisibleWindowForProcess($parentId)
        if ($hostHandle -ne [IntPtr]::Zero) { break }
        Start-Sleep -Milliseconds 80
    }
    if ($hostHandle -eq [IntPtr]::Zero) { throw "Could not find the Turbo ffmpegger window." }

    $form = New-Object TurboDropOverlay
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
    $form.ShowInTaskbar = $false
    $form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
    $form.BackColor = [System.Drawing.Color]::Black
    $form.Opacity = 0.01
    $form.AllowDrop = $true
    $form.Text = "Turbo ffmpegger drop receiver"
    $form.Bounds = New-Object System.Drawing.Rectangle(-32000, -32000, 1, 1)

    # Creating the handle before Show lets us establish cross-process ownership
    # first. An owned, non-topmost window stays above the HTA but below any other
    # application covering it.
    $overlayHandle = $form.Handle
    [TurboDropNative]::SetOwner($overlayHandle, $hostHandle)

    $form.add_DragEnter({
        param($sender, $eventArgs)
        try {
            [string[]]$paths = Get-DroppedPaths $eventArgs.Data
            if ($paths.Count -gt 0) {
                $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::Copy
                Write-BridgeState "hover"
            } else {
                $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::None
            }
        } catch {
            $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::None
        }
    })

    $form.add_DragLeave({ Write-BridgeState "idle" })

    $form.add_DragDrop({
        param($sender, $eventArgs)
        try {
            [string[]]$paths = Get-DroppedPaths $eventArgs.Data
            if ($paths.Count -gt 0 -and (Write-DropBatch $paths)) {
                Write-BridgeState "dropped"
            }
        } catch {
            Write-BridgeError ("Drop failed: " + $_.Exception.Message)
        }
        Write-BridgeState "idle"
    })

    $script:geometry = $null
    $script:geometryStamp = [DateTime]::MinValue
    $script:regionSignature = ""
    $geometryFile = Join-Path $SessionDir "geometry.txt"
    $stopFile = Join-Path $SessionDir "stop.txt"

    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 100
    $timer.add_Tick({
        try {
            if ([System.IO.File]::Exists($stopFile) -or
                -not [TurboDropNative]::IsWindow($hostHandle)) {
                $form.Close()
                return
            }

            try {
                if ([System.IO.File]::Exists($geometryFile)) {
                    $item = Get-Item -LiteralPath $geometryFile
                    if ($item.LastWriteTimeUtc -ne $script:geometryStamp) {
                        $parts = ([System.IO.File]::ReadAllText($geometryFile, [System.Text.Encoding]::ASCII)).Split('|')
                        if ($parts.Length -eq 11) {
                            $values = @()
                            foreach ($part in $parts) { $values += [int]$part }
                            $script:geometry = $values
                            $script:geometryStamp = $item.LastWriteTimeUtc
                        }
                    }
                }
            } catch {
                # The HTA replaces this tiny file while the timer is running.
                # A sharing violation or partial record is transient; retain the
                # last good geometry and retry instead of disabling the helper.
            }

            $canShow = ($null -ne $script:geometry) -and
                       ($script:geometry[0] -eq 1) -and
                       [TurboDropNative]::IsWindowVisible($hostHandle) -and
                       -not [TurboDropNative]::IsIconic($hostHandle)

            if (-not $canShow) {
                if ($form.Visible) { $form.Hide() }
                return
            }

            $left = $script:geometry[1]
            $top = $script:geometry[2]
            $width = [Math]::Max(1, $script:geometry[3])
            $height = [Math]::Max(1, $script:geometry[4])
            $holeX = $script:geometry[5]
            $holeY = $script:geometry[6]
            $holeWidth = $script:geometry[7]
            $holeHeight = $script:geometry[8]

            # The last two values are the DOM viewport dimensions. Mapping the
            # rectangles through the actual native client size keeps the overlay
            # aligned across IE zoom, Windows display scaling and mixed-DPI moves.
            $viewportWidth = [Math]::Max(1, $script:geometry[9])
            $viewportHeight = [Math]::Max(1, $script:geometry[10])

            $clientSize = [TurboDropNative]::GetClientSize($hostHandle)
            $scaleX = $clientSize.Width / [double]$viewportWidth
            $scaleY = $clientSize.Height / [double]$viewportHeight

            $left = [int][Math]::Round($left * $scaleX)
            $top = [int][Math]::Round($top * $scaleY)
            $width = [Math]::Max(1, [int][Math]::Round($width * $scaleX))
            $height = [Math]::Max(1, [int][Math]::Round($height * $scaleY))
            $holeX = [int][Math]::Round($holeX * $scaleX)
            $holeY = [int][Math]::Round($holeY * $scaleY)
            $holeWidth = [Math]::Max(0, [int][Math]::Round($holeWidth * $scaleX))
            $holeHeight = [Math]::Max(0, [int][Math]::Round($holeHeight * $scaleY))

            $origin = [TurboDropNative]::GetClientOrigin($hostHandle)
            $regionSignature = "$width|$height|$holeX|$holeY|$holeWidth|$holeHeight"
            if ($regionSignature -ne $script:regionSignature) {
                $form.SetBrowseHole($width, $height, $holeX, $holeY, $holeWidth, $holeHeight)
                $script:regionSignature = $regionSignature
            }
            [TurboDropNative]::Place(
                $overlayHandle,
                $origin.X + $left,
                $origin.Y + $top,
                $width,
                $height
            )
            if (-not $form.Visible) { $form.Show() }
        } catch {
            Write-BridgeError ("Drop receiver update failed: " + $_.Exception.Message)
        }
    })

    Write-BridgeState "idle"
    [System.IO.File]::WriteAllText(
        (Join-Path $SessionDir "ready.txt"),
        ("ready|" + $PID),
        [System.Text.Encoding]::ASCII
    )

    $timer.Start()
    [System.Windows.Forms.Application]::Run($form)
    $timer.Stop()
    $timer.Dispose()
    $form.Dispose()
    Remove-BridgeSession
} catch {
    Write-BridgeError $_.Exception.ToString()
    # Leave the diagnostic available long enough for the HTA's 150 ms poller,
    # then clean this private session even when startup failed before the normal
    # WinForms shutdown path was established.
    $failureCleanupDeadline = [DateTime]::UtcNow.AddSeconds(12)
    $failureStopFile = Join-Path $SessionDir "stop.txt"
    while ([DateTime]::UtcNow -lt $failureCleanupDeadline -and
           -not [System.IO.File]::Exists($failureStopFile)) {
        Start-Sleep -Milliseconds 100
    }
    Remove-BridgeSession
    exit 1
}
