[CmdletBinding()]
param(
    [string]$Action = '',

    [string]$AppRoot = '',
    [string]$CurrentVersion = '',
    [string]$StatusPath = '',
    [string]$ExpectedTag = ''
)

# Turbo ffmpegger updater
# Windows PowerShell 5.1 compatible. The script can be dot-sourced for tests;
# no updater action is run when it is dot-sourced.

$script:TurboUpdaterRepository = 'TurboTosti/Turbo-ffmpegger'
$script:TurboUpdaterApiRoot = 'https://api.github.com/repos/TurboTosti/Turbo-ffmpegger'
$script:TurboUpdaterUserAgent = 'Turbo-ffmpegger-Updater/1.0'
$script:TurboUpdaterMaximumDownloadBytes = [Int64]4294967296
$script:TurboUpdaterMaximumArchiveFiles = 20000
$script:TurboUpdaterProtectedPaths = @(
    'Data/settings.json',
    'Data/custom_presets.json',
    'Data/ffmpeg.exe',
    'Data/ffprobe.exe',
    'Data/version.txt',
    'Data/update_manifest.txt'
)

function Get-TurboFullPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [System.IO.Path]::GetFullPath($Path)
}

function Test-TurboPathIsWithin {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    $fullPath = Get-TurboFullPath -Path $Path
    $fullRoot = (Get-TurboFullPath -Path $Root).TrimEnd([char[]]@('\', '/'))

    if ([string]::Equals($fullPath, $fullRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    $rootPrefix = $fullRoot + [System.IO.Path]::DirectorySeparatorChar
    return $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-TurboRelativePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    $fullPath = Get-TurboFullPath -Path $Path
    $fullRoot = (Get-TurboFullPath -Path $Root).TrimEnd([char[]]@('\', '/'))
    $rootPrefix = $fullRoot + [System.IO.Path]::DirectorySeparatorChar

    if ([string]::Equals($fullPath, $fullRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        return ''
    }

    if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The path is outside the expected root: $fullPath"
    }

    return $fullPath.Substring($rootPrefix.Length).Replace('\', '/')
}

function Resolve-TurboAppRoot {
    param(
        [string]$RequestedRoot
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedRoot)) {
        $candidate = $RequestedRoot
    }
    else {
        $scriptDirectory = $PSScriptRoot
        if ([string]::IsNullOrWhiteSpace($scriptDirectory)) {
            throw 'AppRoot is required when the script directory cannot be determined.'
        }

        if ([string]::Equals((Split-Path -Leaf $scriptDirectory), 'Data', [System.StringComparison]::OrdinalIgnoreCase)) {
            $candidate = Split-Path -Parent $scriptDirectory
        }
        else {
            $candidate = $scriptDirectory
        }
    }

    $resolved = Get-TurboFullPath -Path $candidate
    if (-not (Test-Path -LiteralPath $resolved -PathType Container)) {
        throw "The application folder does not exist: $resolved"
    }

    $requiredInstalledFiles = @(
        (Join-Path $resolved 'Launcher.bat'),
        (Join-Path $resolved 'Data\Turbo ffmpegger.hta')
    )
    foreach ($requiredFile in $requiredInstalledFiles) {
        if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
            throw "The selected folder is not a complete Turbo ffmpegger installation. Missing: $requiredFile"
        }
    }

    return $resolved.TrimEnd([char[]]@('\', '/'))
}

function Resolve-TurboStatusPath {
    param(
        [string]$RequestedPath,

        [Parameter(Mandatory = $true)]
        [string]$ResolvedAppRoot
    )

    if ([string]::IsNullOrWhiteSpace($RequestedPath)) {
        return Join-Path $ResolvedAppRoot 'Data\update_status.txt'
    }

    if ([System.IO.Path]::IsPathRooted($RequestedPath)) {
        return Get-TurboFullPath -Path $RequestedPath
    }

    return Get-TurboFullPath -Path (Join-Path $ResolvedAppRoot $RequestedPath)
}

function ConvertTo-TurboStatusValue {
    param(
        [AllowNull()]
        [object]$Value
    )

    if ($null -eq $Value) {
        return ''
    }

    if ($Value -is [bool]) {
        if ($Value) { return 'true' }
        return 'false'
    }

    $text = [string]$Value
    $text = $text.Replace([char]0, ' ')
    $text = $text.Replace("`r", ' ').Replace("`n", ' ')
    while ($text.Contains('  ')) {
        $text = $text.Replace('  ', ' ')
    }

    return $text.Trim()
}

function Invoke-TurboWithRetry {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Operation,

        [Parameter(Mandatory = $true)]
        [string]$Description,

        [int]$Attempts = 8
    )

    $delayMilliseconds = 125
    $lastError = $null

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            return & $Operation
        }
        catch {
            $lastError = $_
            if ($attempt -ge $Attempts) {
                break
            }

            Start-Sleep -Milliseconds $delayMilliseconds
            $delayMilliseconds = [Math]::Min($delayMilliseconds * 2, 2000)
        }
    }

    $detail = 'Unknown error.'
    if ($null -ne $lastError -and $null -ne $lastError.Exception) {
        $detail = $lastError.Exception.Message
    }
    throw "$Description failed after $Attempts attempts. $detail"
}

function Write-TurboUtf8Lines {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [string[]]$Lines
    )

    $fullPath = Get-TurboFullPath -Path $Path
    $parentDirectory = Split-Path -Parent $fullPath
    if (-not (Test-Path -LiteralPath $parentDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $parentDirectory -Force -ErrorAction Stop | Out-Null
    }

    $temporaryPath = Join-Path $parentDirectory ('.' + [System.IO.Path]::GetFileName($fullPath) + '.' + [Guid]::NewGuid().ToString('N') + '.tmp')
    $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)

    try {
        [System.IO.File]::WriteAllLines($temporaryPath, $Lines, $utf8WithoutBom)
        Invoke-TurboWithRetry -Description "Writing $fullPath" -Operation {
            Move-Item -LiteralPath $temporaryPath -Destination $fullPath -Force -ErrorAction Stop
        }
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath -PathType Leaf) {
            Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Write-TurboUpdateStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [System.Collections.IDictionary]$Fields
    )

    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($keyObject in $Fields.Keys) {
        $key = [string]$keyObject
        if ($key -notmatch '^[A-Za-z][A-Za-z0-9_]*$') {
            throw "Invalid update status key: $key"
        }

        $lines.Add($key + '=' + (ConvertTo-TurboStatusValue -Value $Fields[$keyObject]))
    }

    Write-TurboUtf8Lines -Path $Path -Lines $lines.ToArray()
}

function New-TurboStatusFields {
    param(
        [Parameter(Mandatory = $true)]
        [string]$State,

        [Parameter(Mandatory = $true)]
        [string]$RequestedAction,

        [string]$ResolvedCurrentVersion = '',
        [string]$Message = ''
    )

    return [ordered]@{
        state = $State
        action = $RequestedAction
        currentVersion = $ResolvedCurrentVersion
        message = $Message
        timestampUtc = [DateTime]::UtcNow.ToString('o')
    }
}

function ConvertTo-TurboSemanticVersion {
    param(
        [AllowNull()]
        [string]$Text
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $null
    }

    $trimmed = $Text.Trim()
    $pattern = '^[vV]?(?<major>0|[1-9][0-9]*)\.(?<minor>0|[1-9][0-9]*)(?:\.(?<patch>0|[1-9][0-9]*))?(?:[-_](?<pre>[0-9A-Za-z][0-9A-Za-z.-]*))?(?:\+[0-9A-Za-z][0-9A-Za-z.-]*)?$'
    $match = [System.Text.RegularExpressions.Regex]::Match($trimmed, $pattern)
    if (-not $match.Success) {
        return $null
    }

    $patch = '0'
    if ($match.Groups['patch'].Success) {
        $patch = $match.Groups['patch'].Value
    }

    $preRelease = ''
    if ($match.Groups['pre'].Success) {
        $preRelease = $match.Groups['pre'].Value
    }

    return [PSCustomObject]@{
        Original = $trimmed
        Major = $match.Groups['major'].Value
        Minor = $match.Groups['minor'].Value
        Patch = $patch
        PreRelease = $preRelease
    }
}

function Compare-TurboNumericText {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Left,

        [Parameter(Mandatory = $true)]
        [string]$Right
    )

    $leftNormalized = $Left.TrimStart('0')
    $rightNormalized = $Right.TrimStart('0')
    if ($leftNormalized.Length -eq 0) { $leftNormalized = '0' }
    if ($rightNormalized.Length -eq 0) { $rightNormalized = '0' }

    if ($leftNormalized.Length -lt $rightNormalized.Length) { return -1 }
    if ($leftNormalized.Length -gt $rightNormalized.Length) { return 1 }

    $comparison = [System.StringComparer]::Ordinal.Compare($leftNormalized, $rightNormalized)
    if ($comparison -lt 0) { return -1 }
    if ($comparison -gt 0) { return 1 }
    return 0
}

function Compare-TurboSemanticVersion {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Left,

        [Parameter(Mandatory = $true)]
        [object]$Right
    )

    foreach ($component in @('Major', 'Minor', 'Patch')) {
        $result = Compare-TurboNumericText -Left ([string]$Left.$component) -Right ([string]$Right.$component)
        if ($result -ne 0) { return $result }
    }

    $leftPre = [string]$Left.PreRelease
    $rightPre = [string]$Right.PreRelease
    if ([string]::IsNullOrEmpty($leftPre) -and [string]::IsNullOrEmpty($rightPre)) { return 0 }
    if ([string]::IsNullOrEmpty($leftPre)) { return 1 }
    if ([string]::IsNullOrEmpty($rightPre)) { return -1 }

    $leftParts = $leftPre.Split('.')
    $rightParts = $rightPre.Split('.')
    $partCount = [Math]::Max($leftParts.Length, $rightParts.Length)

    for ($index = 0; $index -lt $partCount; $index++) {
        if ($index -ge $leftParts.Length) { return -1 }
        if ($index -ge $rightParts.Length) { return 1 }

        $leftPart = $leftParts[$index]
        $rightPart = $rightParts[$index]
        $leftIsNumeric = $leftPart -match '^[0-9]+$'
        $rightIsNumeric = $rightPart -match '^[0-9]+$'

        if ($leftIsNumeric -and $rightIsNumeric) {
            $result = Compare-TurboNumericText -Left $leftPart -Right $rightPart
        }
        elseif ($leftIsNumeric -and -not $rightIsNumeric) {
            $result = -1
        }
        elseif (-not $leftIsNumeric -and $rightIsNumeric) {
            $result = 1
        }
        else {
            $result = [System.StringComparer]::OrdinalIgnoreCase.Compare($leftPart, $rightPart)
            if ($result -lt 0) { $result = -1 }
            elseif ($result -gt 0) { $result = 1 }
        }

        if ($result -ne 0) { return $result }
    }

    return 0
}

function Get-TurboObjectProperty {
    param(
        [AllowNull()]
        [object]$InputObject,

        [Parameter(Mandatory = $true)]
        [string]$Name,

        [AllowNull()]
        [object]$DefaultValue = $null
    )

    if ($null -eq $InputObject) { return $DefaultValue }
    $property = $InputObject.PSObject.Properties[$Name]
    if ($null -eq $property) { return $DefaultValue }
    return $property.Value
}

function Assert-TurboGitHubUri {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Uri
    )

    $parsed = $null
    if (-not [System.Uri]::TryCreate($Uri, [System.UriKind]::Absolute, [ref]$parsed)) {
        throw "The update service returned an invalid download address: $Uri"
    }

    if (-not [string]::Equals($parsed.Scheme, 'https', [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Update downloads must use HTTPS.'
    }
    if (-not $parsed.IsDefaultPort -and $parsed.Port -ne 443) {
        throw 'The update download uses an unexpected network port.'
    }
    if (-not [string]::IsNullOrEmpty($parsed.UserInfo)) {
        throw 'The update download address contains unexpected credentials.'
    }

    $allowedHosts = @(
        'api.github.com',
        'github.com',
        'codeload.github.com',
        'objects.githubusercontent.com',
        'release-assets.githubusercontent.com',
        'github-releases.githubusercontent.com'
    )
    $hostAllowed = $false
    foreach ($allowedHost in $allowedHosts) {
        if ([string]::Equals($parsed.DnsSafeHost, $allowedHost, [System.StringComparison]::OrdinalIgnoreCase)) {
            $hostAllowed = $true
            break
        }
    }

    if (-not $hostAllowed) {
        throw "The update service returned an untrusted download host: $($parsed.DnsSafeHost)"
    }

    return $parsed
}

function Invoke-TurboGitHubApi {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Uri
    )

    $validatedUri = Assert-TurboGitHubUri -Uri $Uri
    if (-not [string]::Equals($validatedUri.DnsSafeHost, 'api.github.com', [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'GitHub API requests must use api.github.com.'
    }

    $previousProtocol = [System.Net.ServicePointManager]::SecurityProtocol
    try {
        [System.Net.ServicePointManager]::SecurityProtocol = $previousProtocol -bor [System.Net.SecurityProtocolType]::Tls12
        $headers = @{
            Accept = 'application/vnd.github+json'
        }
        return Invoke-RestMethod -Method Get -Uri $validatedUri.AbsoluteUri -Headers $headers -UserAgent $script:TurboUpdaterUserAgent -TimeoutSec 30 -ErrorAction Stop
    }
    finally {
        [System.Net.ServicePointManager]::SecurityProtocol = $previousProtocol
    }
}

function Get-TurboPublishedReleases {
    $uri = $script:TurboUpdaterApiRoot + '/releases?per_page=100'
    $response = Invoke-TurboGitHubApi -Uri $uri
    $published = New-Object System.Collections.Generic.List[object]

    foreach ($release in @($response)) {
        $isDraft = [bool](Get-TurboObjectProperty -InputObject $release -Name 'draft' -DefaultValue $false)
        $publishedAt = [string](Get-TurboObjectProperty -InputObject $release -Name 'published_at' -DefaultValue '')
        if (-not $isDraft -and -not [string]::IsNullOrWhiteSpace($publishedAt)) {
            $published.Add($release)
        }
    }

    return $published.ToArray()
}

function Get-TurboNewestRelease {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Releases
    )

    $bestRelease = $null
    $bestVersion = $null
    $bestPublishedAt = [DateTimeOffset]::MinValue

    foreach ($release in $Releases) {
        $tag = [string](Get-TurboObjectProperty -InputObject $release -Name 'tag_name' -DefaultValue '')
        $semanticVersion = ConvertTo-TurboSemanticVersion -Text $tag
        if ($null -eq $semanticVersion) {
            continue
        }

        $releaseDate = [DateTimeOffset]::MinValue
        $releaseDateText = [string](Get-TurboObjectProperty -InputObject $release -Name 'published_at' -DefaultValue '')
        [void][DateTimeOffset]::TryParse($releaseDateText, [ref]$releaseDate)

        $replaceBest = $false
        if ($null -eq $bestRelease) {
            $replaceBest = $true
        }
        else {
            $comparison = Compare-TurboSemanticVersion -Left $semanticVersion -Right $bestVersion
            if ($comparison -gt 0 -or ($comparison -eq 0 -and $releaseDate -gt $bestPublishedAt)) {
                $replaceBest = $true
            }
        }

        if ($replaceBest) {
            $bestRelease = $release
            $bestVersion = $semanticVersion
            $bestPublishedAt = $releaseDate
        }
    }

    if ($null -eq $bestRelease) {
        throw 'No published release with a semantic version tag was found.'
    }

    return [PSCustomObject]@{
        Release = $bestRelease
        Version = $bestVersion
        PublishedAt = $bestPublishedAt
    }
}

function Get-TurboExactRelease {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Tag
    )

    if ($null -eq (ConvertTo-TurboSemanticVersion -Text $Tag)) {
        throw "The requested release tag is not a supported semantic version: $Tag"
    }

    $escapedTag = [System.Uri]::EscapeDataString($Tag)
    $uri = $script:TurboUpdaterApiRoot + '/releases/tags/' + $escapedTag
    $release = Invoke-TurboGitHubApi -Uri $uri
    $actualTag = [string](Get-TurboObjectProperty -InputObject $release -Name 'tag_name' -DefaultValue '')
    $isDraft = [bool](Get-TurboObjectProperty -InputObject $release -Name 'draft' -DefaultValue $false)
    $publishedAt = [string](Get-TurboObjectProperty -InputObject $release -Name 'published_at' -DefaultValue '')

    if (-not [string]::Equals($actualTag, $Tag, [System.StringComparison]::Ordinal)) {
        throw 'GitHub returned a different release than the one selected during the update check.'
    }
    if ($isDraft -or [string]::IsNullOrWhiteSpace($publishedAt)) {
        throw 'The selected release is not published.'
    }

    return $release
}

function Get-TurboReleaseCandidates {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Release
    )

    $tag = [string](Get-TurboObjectProperty -InputObject $Release -Name 'tag_name' -DefaultValue '')
    $rankedAssets = New-Object System.Collections.Generic.List[object]

    foreach ($asset in @(Get-TurboObjectProperty -InputObject $Release -Name 'assets' -DefaultValue @())) {
        $name = [string](Get-TurboObjectProperty -InputObject $asset -Name 'name' -DefaultValue '')
        $url = [string](Get-TurboObjectProperty -InputObject $asset -Name 'browser_download_url' -DefaultValue '')
        if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($url)) { continue }
        if (-not $name.EndsWith('.zip', [System.StringComparison]::OrdinalIgnoreCase)) { continue }

        $score = 0
        if ($name -match '(?i)turbo[\s._-]*ffmpegger') { $score += 100 }
        if (-not [string]::IsNullOrWhiteSpace($tag) -and $name.IndexOf($tag, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $score += 40 }
        if ($name -match '(?i)(windows|win64|portable)') { $score += 20 }
        if ($name -match '(?i)(source|symbols|debug)') { $score -= 80 }

        $rankedAssets.Add([PSCustomObject]@{
            Score = $score
            Name = $name
            Url = $url
            Digest = [string](Get-TurboObjectProperty -InputObject $asset -Name 'digest' -DefaultValue '')
        })
    }

    $candidates = New-Object System.Collections.Generic.List[object]
    $bestAsset = $rankedAssets | Sort-Object -Property @{ Expression = 'Score'; Descending = $true }, @{ Expression = 'Name'; Descending = $false } | Select-Object -First 1
    if ($null -ne $bestAsset) {
        [void](Assert-TurboGitHubUri -Uri $bestAsset.Url)
        $candidates.Add([PSCustomObject]@{
            Kind = 'asset'
            Name = $bestAsset.Name
            Url = $bestAsset.Url
            Digest = $bestAsset.Digest
        })
    }

    $zipballUrl = [string](Get-TurboObjectProperty -InputObject $Release -Name 'zipball_url' -DefaultValue '')
    if (-not [string]::IsNullOrWhiteSpace($zipballUrl)) {
        [void](Assert-TurboGitHubUri -Uri $zipballUrl)
        $candidates.Add([PSCustomObject]@{
            Kind = 'zipball'
            Name = $tag + '-source.zip'
            Url = $zipballUrl
            Digest = ''
        })
    }

    if ($candidates.Count -eq 0) {
        throw 'The selected release has no usable ZIP package or source archive.'
    }

    return $candidates.ToArray()
}

function Invoke-TurboDownload {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    $currentUri = Assert-TurboGitHubUri -Uri $Uri
    $previousProtocol = [System.Net.ServicePointManager]::SecurityProtocol
    $response = $null
    $output = $null

    try {
        [System.Net.ServicePointManager]::SecurityProtocol = $previousProtocol -bor [System.Net.SecurityProtocolType]::Tls12

        for ($redirectCount = 0; $redirectCount -le 10; $redirectCount++) {
            $request = [System.Net.HttpWebRequest]::Create($currentUri)
            $request.Method = 'GET'
            $request.AllowAutoRedirect = $false
            $request.UserAgent = $script:TurboUpdaterUserAgent
            $request.Accept = 'application/octet-stream, application/zip, application/vnd.github+json'
            $request.Timeout = 30000
            $request.ReadWriteTimeout = 30000
            $request.KeepAlive = $false

            $response = $request.GetResponse()
            $statusCode = [int]$response.StatusCode
            if ($statusCode -ge 300 -and $statusCode -lt 400) {
                $location = $response.Headers['Location']
                $response.Close()
                $response = $null
                if ([string]::IsNullOrWhiteSpace($location)) {
                    throw 'GitHub returned a redirect without a destination.'
                }
                if ($redirectCount -ge 10) {
                    throw 'The update download used too many redirects.'
                }

                $nextUri = [System.Uri]::new($currentUri, $location)
                $currentUri = Assert-TurboGitHubUri -Uri $nextUri.AbsoluteUri
                continue
            }

            if ($statusCode -ne 200) {
                throw "The update download returned HTTP status $statusCode."
            }

            [void](Assert-TurboGitHubUri -Uri $response.ResponseUri.AbsoluteUri)
            $contentLength = [Int64]$response.ContentLength
            if ($contentLength -gt $script:TurboUpdaterMaximumDownloadBytes) {
                throw 'The update package is larger than the allowed safety limit.'
            }

            $input = $response.GetResponseStream()
            try {
                $output = [System.IO.FileStream]::new($Destination, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
                $buffer = New-Object byte[] 1048576
                $downloaded = [Int64]0
                while (($bytesRead = $input.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $downloaded += $bytesRead
                    if ($downloaded -gt $script:TurboUpdaterMaximumDownloadBytes) {
                        throw 'The update package exceeded the allowed safety limit while downloading.'
                    }
                    $output.Write($buffer, 0, $bytesRead)
                }
                $output.Flush()
            }
            finally {
                if ($null -ne $output) { $output.Dispose(); $output = $null }
                if ($null -ne $input) { $input.Dispose() }
            }

            if (-not (Test-Path -LiteralPath $Destination -PathType Leaf) -or (Get-Item -LiteralPath $Destination).Length -eq 0) {
                throw 'The downloaded update package is empty.'
            }

            return
        }
    }
    finally {
        if ($null -ne $output) { $output.Dispose() }
        if ($null -ne $response) { $response.Close() }
        [System.Net.ServicePointManager]::SecurityProtocol = $previousProtocol
    }
}

function Get-TurboFileHash {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return Invoke-TurboWithRetry -Description "Reading $Path" -Operation {
        (Get-FileHash -LiteralPath $Path -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
    }
}

function Test-TurboArchiveSegment {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Segment
    )

    if ([string]::IsNullOrWhiteSpace($Segment) -or $Segment -eq '.' -or $Segment -eq '..') {
        return $false
    }
    if ($Segment.EndsWith(' ') -or $Segment.EndsWith('.')) {
        return $false
    }
    if ($Segment.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -ge 0) {
        return $false
    }

    $baseName = $Segment.Split('.')[0].ToUpperInvariant()
    if ($baseName -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$') {
        return $false
    }

    return $true
}

function Expand-TurboSafeZip {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ZipPath,

        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    Add-Type -AssemblyName System.IO.Compression -ErrorAction Stop
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop

    $destinationFull = (Get-TurboFullPath -Path $Destination).TrimEnd([char[]]@('\', '/'))
    if (Test-Path -LiteralPath $destinationFull) {
        throw "The extraction folder already exists: $destinationFull"
    }
    New-Item -ItemType Directory -Path $destinationFull -Force -ErrorAction Stop | Out-Null

    $destinationPrefix = $destinationFull + [System.IO.Path]::DirectorySeparatorChar
    $archive = $null
    try {
        $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
        if ($archive.Entries.Count -gt $script:TurboUpdaterMaximumArchiveFiles) {
            throw 'The update archive contains too many files.'
        }

        $plannedEntries = New-Object System.Collections.Generic.List[object]
        $seenDestinations = @{}
        $totalLength = [Int64]0

        foreach ($entry in $archive.Entries) {
            $rawName = [string]$entry.FullName
            if ([string]::IsNullOrWhiteSpace($rawName)) {
                throw 'The update archive contains an entry without a name.'
            }
            if ($rawName.IndexOf([char]0) -ge 0 -or $rawName.StartsWith('/') -or $rawName.StartsWith('\') -or $rawName -match '^[A-Za-z]:' -or $rawName.Contains(':')) {
                throw "The update archive contains an unsafe path: $rawName"
            }

            $relative = $rawName.Replace('/', '\')
            $isDirectory = $relative.EndsWith('\') -or [string]::IsNullOrEmpty([string]$entry.Name)
            $relativeForParts = $relative.TrimEnd('\')
            $segments = $relativeForParts.Split('\')
            foreach ($segment in $segments) {
                if (-not (Test-TurboArchiveSegment -Segment $segment)) {
                    throw "The update archive contains an unsafe path: $rawName"
                }
            }

            $entryDestination = Get-TurboFullPath -Path (Join-Path $destinationFull $relativeForParts)
            if (-not $entryDestination.StartsWith($destinationPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "The update archive attempts to write outside its extraction folder: $rawName"
            }

            $destinationKey = $entryDestination.ToLowerInvariant()
            if ($seenDestinations.ContainsKey($destinationKey)) {
                throw "The update archive contains duplicate paths: $rawName"
            }
            $seenDestinations[$destinationKey] = $true

            if (-not $isDirectory) {
                $totalLength += [Int64]$entry.Length
                if ($totalLength -gt $script:TurboUpdaterMaximumDownloadBytes) {
                    throw 'The extracted update package is larger than the allowed safety limit.'
                }
            }

            $plannedEntries.Add([PSCustomObject]@{
                Entry = $entry
                Destination = $entryDestination
                IsDirectory = $isDirectory
            })
        }

        foreach ($planned in $plannedEntries) {
            if ($planned.IsDirectory) {
                New-Item -ItemType Directory -Path $planned.Destination -Force -ErrorAction Stop | Out-Null
                continue
            }

            $parent = Split-Path -Parent $planned.Destination
            if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
                New-Item -ItemType Directory -Path $parent -Force -ErrorAction Stop | Out-Null
            }

            $entryStream = $null
            $fileStream = $null
            try {
                $entryStream = $planned.Entry.Open()
                $fileStream = [System.IO.FileStream]::new($planned.Destination, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
                $entryStream.CopyTo($fileStream)
                $fileStream.Flush()
            }
            finally {
                if ($null -ne $fileStream) { $fileStream.Dispose() }
                if ($null -ne $entryStream) { $entryStream.Dispose() }
            }
        }
    }
    finally {
        if ($null -ne $archive) { $archive.Dispose() }
    }
}

function Find-TurboPayloadRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ExtractionRoot
    )

    $candidates = New-Object System.Collections.Generic.List[object]
    foreach ($launcher in @(Get-ChildItem -LiteralPath $ExtractionRoot -Filter 'Launcher.bat' -File -Recurse -ErrorAction Stop)) {
        $candidateRoot = $launcher.Directory.FullName
        $dataDirectory = Join-Path $candidateRoot 'Data'
        if (-not (Test-Path -LiteralPath $dataDirectory -PathType Container)) { continue }
        if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory 'Turbo ffmpegger.hta') -PathType Leaf)) { continue }

        $relative = Get-TurboRelativePath -Path $candidateRoot -Root $ExtractionRoot
        $depth = 0
        if (-not [string]::IsNullOrWhiteSpace($relative)) {
            $depth = ($relative -split '/').Length
        }
        $fileCount = @(Get-ChildItem -LiteralPath $dataDirectory -File -Recurse -ErrorAction Stop).Count + 1
        $candidates.Add([PSCustomObject]@{
            Root = $candidateRoot
            Depth = $depth
            FileCount = $fileCount
        })
    }

    if ($candidates.Count -eq 0) {
        throw 'The downloaded package does not contain Launcher.bat and Data\Turbo ffmpegger.hta.'
    }

    $ordered = @($candidates | Sort-Object -Property @{ Expression = 'Depth'; Descending = $false }, @{ Expression = 'FileCount'; Descending = $true }, @{ Expression = 'Root'; Descending = $false })
    if ($ordered.Count -gt 1 -and $ordered[0].Depth -eq $ordered[1].Depth -and $ordered[0].FileCount -eq $ordered[1].FileCount) {
        throw 'The downloaded package contains more than one possible application folder.'
    }

    return [string]$ordered[0].Root
}

function Test-TurboProtectedPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RelativePath
    )

    foreach ($protected in $script:TurboUpdaterProtectedPaths) {
        if ([string]::Equals($RelativePath.Replace('\', '/'), $protected, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

function Assert-TurboOwnedRelativePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RelativePath,

        [switch]$AllowProtected
    )

    $normalized = $RelativePath.Trim().Replace('\', '/')
    if ([string]::IsNullOrWhiteSpace($normalized) -or [System.IO.Path]::IsPathRooted($normalized) -or $normalized.StartsWith('/') -or $normalized.Contains(':')) {
        throw "Unsafe application-relative path: $RelativePath"
    }

    $segments = $normalized.Split('/')
    foreach ($segment in $segments) {
        if (-not (Test-TurboArchiveSegment -Segment $segment)) {
            throw "Unsafe application-relative path: $RelativePath"
        }
    }

    $inOwnedScope = [string]::Equals($normalized, 'Launcher.bat', [System.StringComparison]::OrdinalIgnoreCase) -or $normalized.StartsWith('Data/', [System.StringComparison]::OrdinalIgnoreCase)
    if (-not $inOwnedScope) {
        throw "The updater cannot manage files outside Launcher.bat and Data: $RelativePath"
    }
    if (-not $AllowProtected -and (Test-TurboProtectedPath -RelativePath $normalized)) {
        throw "The updater cannot replace a protected local file: $RelativePath"
    }

    return $normalized
}

function Get-TurboSafeTargetPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppRoot,

        [Parameter(Mandatory = $true)]
        [string]$RelativePath,

        [switch]$AllowProtected
    )

    $normalized = Assert-TurboOwnedRelativePath -RelativePath $RelativePath -AllowProtected:$AllowProtected
    $fullPath = Get-TurboFullPath -Path (Join-Path $AppRoot $normalized.Replace('/', '\'))
    if (-not (Test-TurboPathIsWithin -Path $fullPath -Root $AppRoot)) {
        throw "Unsafe update target: $RelativePath"
    }
    return $fullPath
}

function Get-TurboPackageFiles {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PayloadRoot
    )

    $result = New-Object System.Collections.Generic.List[object]
    $launcherPath = Join-Path $PayloadRoot 'Launcher.bat'
    if (-not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
        throw 'The update package is missing Launcher.bat.'
    }
    $requiredHtaPath = Join-Path $PayloadRoot 'Data\Turbo ffmpegger.hta'
    if (-not (Test-Path -LiteralPath $requiredHtaPath -PathType Leaf)) {
        throw 'The update package is missing Data\Turbo ffmpegger.hta.'
    }

    $allFiles = New-Object System.Collections.Generic.List[object]
    $allFiles.Add((Get-Item -LiteralPath $launcherPath -ErrorAction Stop))
    $dataRoot = Join-Path $PayloadRoot 'Data'
    foreach ($file in @(Get-ChildItem -LiteralPath $dataRoot -File -Recurse -ErrorAction Stop)) {
        $allFiles.Add($file)
    }

    $seen = @{}
    foreach ($file in $allFiles) {
        $relative = Get-TurboRelativePath -Path $file.FullName -Root $PayloadRoot
        $relative = Assert-TurboOwnedRelativePath -RelativePath $relative -AllowProtected
        $isUserConfigDefault = $false
        if (Test-TurboProtectedPath -RelativePath $relative) {
            $isUserConfigDefault = [string]::Equals($relative, 'Data/settings.json', [System.StringComparison]::OrdinalIgnoreCase) -or [string]::Equals($relative, 'Data/custom_presets.json', [System.StringComparison]::OrdinalIgnoreCase)
            if (-not $isUserConfigDefault) {
                continue
            }
        }

        $key = $relative.ToLowerInvariant()
        if ($seen.ContainsKey($key)) {
            throw "The package contains duplicate application paths: $relative"
        }
        $seen[$key] = $true

        $result.Add([PSCustomObject]@{
            RelativePath = $relative
            SourcePath = $file.FullName
            Hash = Get-TurboFileHash -Path $file.FullName
            InstallIfMissing = $isUserConfigDefault
            IsManaged = -not $isUserConfigDefault
        })
    }

    if ($result.Count -eq 0) {
        throw 'The update package contains no updateable application files.'
    }

    return $result.ToArray()
}

function Get-TurboOldManifestPaths {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppRoot
    )

    $manifestPath = Join-Path $AppRoot 'Data\update_manifest.txt'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        return @()
    }

    $result = New-Object System.Collections.Generic.List[string]
    $seen = @{}
    foreach ($line in [System.IO.File]::ReadAllLines($manifestPath)) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) { continue }
        try {
            $normalized = Assert-TurboOwnedRelativePath -RelativePath $trimmed
        }
        catch {
            # A malformed or protected entry is never trusted for deletion.
            continue
        }

        $key = $normalized.ToLowerInvariant()
        if (-not $seen.ContainsKey($key)) {
            $seen[$key] = $true
            $result.Add($normalized)
        }
    }

    return $result.ToArray()
}

function Add-TurboTransactionTarget {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.Collections.ArrayList]$Records,

        [Parameter(Mandatory = $true)]
        [hashtable]$Seen,

        [Parameter(Mandatory = $true)]
        [string]$AppRoot,

        [Parameter(Mandatory = $true)]
        [string]$BackupRoot,

        [Parameter(Mandatory = $true)]
        [string]$RelativePath
    )

    $allowProtected = Test-TurboProtectedPath -RelativePath $RelativePath
    $targetPath = Get-TurboSafeTargetPath -AppRoot $AppRoot -RelativePath $RelativePath -AllowProtected:$allowProtected
    $key = $targetPath.ToLowerInvariant()
    if ($Seen.ContainsKey($key)) { return }
    $Seen[$key] = $true

    if ((Test-Path -LiteralPath $targetPath) -and -not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
        throw "A folder is blocking the update target: $RelativePath"
    }

    $existed = Test-Path -LiteralPath $targetPath -PathType Leaf
    $backupPath = Join-Path $BackupRoot $RelativePath.Replace('/', '\')
    if ($existed) {
        $backupParent = Split-Path -Parent $backupPath
        if (-not (Test-Path -LiteralPath $backupParent -PathType Container)) {
            New-Item -ItemType Directory -Path $backupParent -Force -ErrorAction Stop | Out-Null
        }
        Invoke-TurboWithRetry -Description "Backing up $RelativePath" -Operation {
            Copy-Item -LiteralPath $targetPath -Destination $backupPath -Force -ErrorAction Stop
        }
        if ((Get-TurboFileHash -Path $targetPath) -ne (Get-TurboFileHash -Path $backupPath)) {
            throw "The backup verification failed for $RelativePath"
        }
    }

    [void]$Records.Add([PSCustomObject]@{
        RelativePath = $RelativePath
        TargetPath = $targetPath
        BackupPath = $backupPath
        Existed = $existed
    })
}

function Restore-TurboTransaction {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.Collections.ArrayList]$Records
    )

    if ($Records.Count -eq 0) { return }

    $errors = New-Object System.Collections.Generic.List[string]
    for ($index = $Records.Count - 1; $index -ge 0; $index--) {
        $record = $Records[$index]
        try {
            if ($record.Existed) {
                $targetParent = Split-Path -Parent $record.TargetPath
                if (-not (Test-Path -LiteralPath $targetParent -PathType Container)) {
                    New-Item -ItemType Directory -Path $targetParent -Force -ErrorAction Stop | Out-Null
                }
                Invoke-TurboWithRetry -Description "Restoring $($record.RelativePath)" -Operation {
                    Copy-Item -LiteralPath $record.BackupPath -Destination $record.TargetPath -Force -ErrorAction Stop
                }
                if ((Get-TurboFileHash -Path $record.BackupPath) -ne (Get-TurboFileHash -Path $record.TargetPath)) {
                    throw 'The restored file did not match its backup.'
                }
            }
            elseif (Test-Path -LiteralPath $record.TargetPath -PathType Leaf) {
                Invoke-TurboWithRetry -Description "Removing new file $($record.RelativePath)" -Operation {
                    Remove-Item -LiteralPath $record.TargetPath -Force -ErrorAction Stop
                }
            }
        }
        catch {
            $errors.Add($record.RelativePath + ': ' + $_.Exception.Message)
        }
    }

    if ($errors.Count -gt 0) {
        throw ('Rollback could not restore every file. ' + ($errors -join ' | '))
    }
}

function Backup-TurboEditedPresets {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppRoot,

        [Parameter(Mandatory = $true)]
        [object[]]$PackageFiles,

        [Parameter(Mandatory = $true)]
        [string]$ReleaseTag,

        [switch]$ForceBackup
    )

    $packagedPresets = $null
    foreach ($packageFile in $PackageFiles) {
        if ([string]::Equals([string]$packageFile.RelativePath, 'Data/presets.json', [System.StringComparison]::OrdinalIgnoreCase)) {
            $packagedPresets = $packageFile
            break
        }
    }
    if ($null -eq $packagedPresets -and -not $ForceBackup) { return '' }

    $installedPresets = Get-TurboSafeTargetPath -AppRoot $AppRoot -RelativePath 'Data/presets.json'
    if (-not (Test-Path -LiteralPath $installedPresets -PathType Leaf)) { return '' }
    if (-not $ForceBackup -and (Get-TurboFileHash -Path $installedPresets) -eq [string]$packagedPresets.Hash) { return '' }

    $backupDirectory = Join-Path $AppRoot 'Data\update_backups'
    if (-not (Test-Path -LiteralPath $backupDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $backupDirectory -Force -ErrorAction Stop | Out-Null
    }

    $safeTag = [System.Text.RegularExpressions.Regex]::Replace($ReleaseTag, '[^0-9A-Za-z._-]', '_')
    if ([string]::IsNullOrWhiteSpace($safeTag)) { $safeTag = 'update' }
    $backupName = 'presets-before-' + $safeTag + '-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8) + '.json'
    $backupPath = Join-Path $backupDirectory $backupName

    Invoke-TurboWithRetry -Description 'Backing up locally edited built-in presets' -Operation {
        Copy-Item -LiteralPath $installedPresets -Destination $backupPath -ErrorAction Stop
    }
    if ((Get-TurboFileHash -Path $installedPresets) -ne (Get-TurboFileHash -Path $backupPath)) {
        Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
        throw 'The persistent backup of the locally edited built-in presets could not be verified.'
    }

    return $backupPath
}

function Install-TurboPayload {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppRoot,

        [Parameter(Mandatory = $true)]
        [object[]]$PackageFiles,

        [Parameter(Mandatory = $true)]
        [string]$ReleaseTag,

        [Parameter(Mandatory = $true)]
        [string]$BackupRoot
    )

    $newPathSet = @{}
    $manifestLines = New-Object System.Collections.Generic.List[string]
    $changedFiles = New-Object System.Collections.Generic.List[object]

    foreach ($packageFile in $PackageFiles) {
        $relative = [string]$packageFile.RelativePath
        $isManaged = [bool](Get-TurboObjectProperty -InputObject $packageFile -Name 'IsManaged' -DefaultValue $true)
        $installIfMissing = [bool](Get-TurboObjectProperty -InputObject $packageFile -Name 'InstallIfMissing' -DefaultValue $false)
        if ($isManaged) {
            $key = $relative.ToLowerInvariant()
            $newPathSet[$key] = $true
            $manifestLines.Add($relative)
        }

        $target = Get-TurboSafeTargetPath -AppRoot $AppRoot -RelativePath $relative -AllowProtected:(Test-TurboProtectedPath -RelativePath $relative)
        $needsCopy = $true
        if (Test-Path -LiteralPath $target -PathType Leaf) {
            if ($installIfMissing) {
                $needsCopy = $false
            }
            else {
                $needsCopy = (Get-TurboFileHash -Path $target) -ne [string]$packageFile.Hash
            }
        }
        elseif (Test-Path -LiteralPath $target) {
            throw "A folder is blocking the update target: $relative"
        }

        if ($needsCopy) {
            $changedFiles.Add($packageFile)
        }
    }

    $obsoletePaths = New-Object System.Collections.Generic.List[string]
    foreach ($oldPath in @(Get-TurboOldManifestPaths -AppRoot $AppRoot)) {
        if (-not $newPathSet.ContainsKey($oldPath.ToLowerInvariant())) {
            $obsoletePaths.Add($oldPath)
        }
    }

    $records = New-Object System.Collections.ArrayList
    $recordedTargets = @{}
    $presetsBackupPath = ''
    try {
        $presetsWillBeRemoved = $false
        foreach ($obsoletePath in $obsoletePaths) {
            if ([string]::Equals($obsoletePath, 'Data/presets.json', [System.StringComparison]::OrdinalIgnoreCase)) {
                $presetsWillBeRemoved = $true
                break
            }
        }
        $presetsBackupPath = Backup-TurboEditedPresets -AppRoot $AppRoot -PackageFiles $PackageFiles -ReleaseTag $ReleaseTag -ForceBackup:$presetsWillBeRemoved

        $orderedChangedFiles = @($changedFiles | Sort-Object -Property @{ Expression = {
            if ([string]::Equals([string]$_.RelativePath, 'Launcher.bat', [System.StringComparison]::OrdinalIgnoreCase)) { return 100 }
            if ([string]::Equals([string]$_.RelativePath, 'Data/check_for_updates.ps1', [System.StringComparison]::OrdinalIgnoreCase)) { return 90 }
            return 10
        }; Descending = $false }, @{ Expression = 'RelativePath'; Descending = $false })

        foreach ($changedFile in $orderedChangedFiles) {
            Add-TurboTransactionTarget -Records $records -Seen $recordedTargets -AppRoot $AppRoot -BackupRoot $BackupRoot -RelativePath $changedFile.RelativePath
        }
        foreach ($obsoletePath in $obsoletePaths) {
            Add-TurboTransactionTarget -Records $records -Seen $recordedTargets -AppRoot $AppRoot -BackupRoot $BackupRoot -RelativePath $obsoletePath
        }
        Add-TurboTransactionTarget -Records $records -Seen $recordedTargets -AppRoot $AppRoot -BackupRoot $BackupRoot -RelativePath 'Data/version.txt'
        Add-TurboTransactionTarget -Records $records -Seen $recordedTargets -AppRoot $AppRoot -BackupRoot $BackupRoot -RelativePath 'Data/update_manifest.txt'

        foreach ($changedFile in $orderedChangedFiles) {
            $targetPath = Get-TurboSafeTargetPath -AppRoot $AppRoot -RelativePath $changedFile.RelativePath -AllowProtected:(Test-TurboProtectedPath -RelativePath $changedFile.RelativePath)
            $targetParent = Split-Path -Parent $targetPath
            if (-not (Test-Path -LiteralPath $targetParent -PathType Container)) {
                New-Item -ItemType Directory -Path $targetParent -Force -ErrorAction Stop | Out-Null
            }

            Invoke-TurboWithRetry -Description "Installing $($changedFile.RelativePath)" -Operation {
                Copy-Item -LiteralPath $changedFile.SourcePath -Destination $targetPath -Force -ErrorAction Stop
            }
            if ((Get-TurboFileHash -Path $targetPath) -ne [string]$changedFile.Hash) {
                throw "The installed file failed verification: $($changedFile.RelativePath)"
            }
        }

        foreach ($obsoletePath in $obsoletePaths) {
            $obsoleteTarget = Get-TurboSafeTargetPath -AppRoot $AppRoot -RelativePath $obsoletePath
            if (Test-Path -LiteralPath $obsoleteTarget -PathType Leaf) {
                Invoke-TurboWithRetry -Description "Removing obsolete file $obsoletePath" -Operation {
                    Remove-Item -LiteralPath $obsoleteTarget -Force -ErrorAction Stop
                }
            }
        }

        $sortedManifest = @($manifestLines.ToArray() | Sort-Object)
        Write-TurboUtf8Lines -Path (Join-Path $AppRoot 'Data\version.txt') -Lines @($ReleaseTag)
        Write-TurboUtf8Lines -Path (Join-Path $AppRoot 'Data\update_manifest.txt') -Lines $sortedManifest

        return [PSCustomObject]@{
            ChangedCount = $changedFiles.Count
            RemovedCount = $obsoletePaths.Count
            ManagedCount = $manifestLines.Count
            PresetsBackupPath = $presetsBackupPath
        }
    }
    catch {
        $installError = $_
        try {
            Restore-TurboTransaction -Records $records
            $installError.Exception.Data['TurboRollbackSucceeded'] = $true
            $installError.Exception.Data['TurboSafeToRestart'] = $true
            if (-not [string]::IsNullOrWhiteSpace($presetsBackupPath)) {
                $installError.Exception.Data['TurboPresetsBackupPath'] = $presetsBackupPath
            }
        }
        catch {
            $rollbackError = $_.Exception.Message
            $combined = [System.Exception]::new(($installError.Exception.Message + ' Rollback warning: ' + $rollbackError), $installError.Exception)
            $combined.Data['TurboRollbackSucceeded'] = $false
            $combined.Data['TurboSafeToRestart'] = $false
            $combined.Data['TurboRecoveryBackupPath'] = $BackupRoot
            if (-not [string]::IsNullOrWhiteSpace($presetsBackupPath)) {
                $combined.Data['TurboPresetsBackupPath'] = $presetsBackupPath
            }
            throw $combined
        }
        throw $installError
    }
}

function Show-TurboUpdateMessage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $true)]
        [string]$Title,

        [switch]$IsError
    )

    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        $icon = [System.Windows.Forms.MessageBoxIcon]::Information
        if ($IsError) { $icon = [System.Windows.Forms.MessageBoxIcon]::Error }
        [void][System.Windows.Forms.MessageBox]::Show(
            $Message,
            $Title,
            [System.Windows.Forms.MessageBoxButtons]::OK,
            $icon
        )
    }
    catch {
        try {
            $shell = New-Object -ComObject WScript.Shell
            $iconCode = 64
            if ($IsError) { $iconCode = 16 }
            [void]$shell.Popup($Message, 0, $Title, $iconCode)
        }
        catch {
            Write-Host ($Title + ': ' + $Message)
        }
    }
}

function Start-TurboLauncher {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppRoot
    )

    $launcherPath = Join-Path $AppRoot 'Launcher.bat'
    if (-not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
        throw 'The update completed, but Launcher.bat could not be found for restart.'
    }

    Start-Process -FilePath $launcherPath -WorkingDirectory $AppRoot -WindowStyle Hidden -ErrorAction Stop | Out-Null
}

function Wait-TurboParentHtaExit {
    $parentProcessId = 0
    $parentProcess = $null
    try {
        $processInfo = Get-CimInstance -ClassName Win32_Process -Filter ("ProcessId=" + $PID) -OperationTimeoutSec 3 -ErrorAction Stop
        if ($null -ne $processInfo) {
            $parentProcessId = [int]$processInfo.ParentProcessId
        }
    }
    catch {
        try {
            $processInfo = Get-WmiObject -Class Win32_Process -Filter ("ProcessId=" + $PID) -ErrorAction Stop
            if ($null -ne $processInfo) {
                $parentProcessId = [int]$processInfo.ParentProcessId
            }
        }
        catch {
            $parentProcessId = 0
        }
    }

    if ($parentProcessId -gt 0) {
        try {
            $parentProcess = Get-Process -Id $parentProcessId -ErrorAction Stop
            if ([string]::Equals($parentProcess.ProcessName, 'mshta', [System.StringComparison]::OrdinalIgnoreCase)) {
                [void]$parentProcess.WaitForExit(10000)
                return
            }
        }
        catch {
            # Parent exit between lookup and wait is the desired outcome.
            if ($null -ne $parentProcess -and [string]::Equals($parentProcess.ProcessName, 'mshta', [System.StringComparison]::OrdinalIgnoreCase)) {
                return
            }
        }
    }

    Start-Sleep -Milliseconds 750
}

function Resolve-TurboCurrentVersion {
    param(
        [string]$RequestedVersion,

        [Parameter(Mandatory = $true)]
        [string]$AppRoot
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedVersion)) {
        return $RequestedVersion.Trim()
    }

    $versionPath = Join-Path $AppRoot 'Data\version.txt'
    if (Test-Path -LiteralPath $versionPath -PathType Leaf) {
        $firstLine = [System.IO.File]::ReadLines($versionPath) | Select-Object -First 1
        if (-not [string]::IsNullOrWhiteSpace($firstLine)) {
            return $firstLine.Trim()
        }
    }

    return '0.0.0'
}

function Invoke-TurboCheck {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppRoot,

        [Parameter(Mandatory = $true)]
        [string]$CurrentVersion,

        [Parameter(Mandatory = $true)]
        [string]$StatusPath
    )

    Write-TurboUpdateStatus -Path $StatusPath -Fields (New-TurboStatusFields -State 'checking' -RequestedAction 'Check' -ResolvedCurrentVersion $CurrentVersion -Message 'Checking GitHub for updates...')

    $releases = @(Get-TurboPublishedReleases)
    $newest = Get-TurboNewestRelease -Releases $releases
    $release = $newest.Release
    $latestTag = [string](Get-TurboObjectProperty -InputObject $release -Name 'tag_name' -DefaultValue '')
    $currentSemantic = ConvertTo-TurboSemanticVersion -Text $CurrentVersion
    $isAvailable = $true
    if ($null -ne $currentSemantic) {
        $isAvailable = (Compare-TurboSemanticVersion -Left $newest.Version -Right $currentSemantic) -gt 0
    }
    elseif ([string]::Equals($latestTag, $CurrentVersion, [System.StringComparison]::OrdinalIgnoreCase)) {
        $isAvailable = $false
    }

    $state = 'up-to-date'
    $message = 'Turbo ffmpegger is up to date.'
    if ($isAvailable) {
        $state = 'available'
        $message = "Turbo ffmpegger $latestTag is available."
    }

    $fields = New-TurboStatusFields -State $state -RequestedAction 'Check' -ResolvedCurrentVersion $CurrentVersion -Message $message
    $fields['version'] = $latestTag
    $fields['latestVersion'] = $latestTag
    $fields['tag'] = $latestTag
    $fields['releaseName'] = [string](Get-TurboObjectProperty -InputObject $release -Name 'name' -DefaultValue $latestTag)
    $fields['publishedAt'] = [string](Get-TurboObjectProperty -InputObject $release -Name 'published_at' -DefaultValue '')
    $fields['prerelease'] = [bool](Get-TurboObjectProperty -InputObject $release -Name 'prerelease' -DefaultValue $false)
    $fields['releaseUrl'] = [string](Get-TurboObjectProperty -InputObject $release -Name 'html_url' -DefaultValue '')
    Write-TurboUpdateStatus -Path $StatusPath -Fields $fields

    return [PSCustomObject]@{
        State = $state
        CurrentVersion = $CurrentVersion
        LatestVersion = $latestTag
        UpdateAvailable = $isAvailable
    }
}

function Invoke-TurboInstall {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppRoot,

        [Parameter(Mandatory = $true)]
        [string]$CurrentVersion,

        [Parameter(Mandatory = $true)]
        [string]$StatusPath,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedTag
    )

    if ([string]::IsNullOrWhiteSpace($ExpectedTag)) {
        throw 'ExpectedTag is required for installation so the checked release cannot change mid-update.'
    }

    $installingFields = New-TurboStatusFields -State 'preparing' -RequestedAction 'Install' -ResolvedCurrentVersion $CurrentVersion -Message "Preparing Turbo ffmpegger $ExpectedTag..."
    $installingFields['latestVersion'] = $ExpectedTag
    $installingFields['tag'] = $ExpectedTag
    Write-TurboUpdateStatus -Path $StatusPath -Fields $installingFields

    # Re-fetch the exact checked tag. Never use a mutable "latest" URL here.
    $release = Get-TurboExactRelease -Tag $ExpectedTag
    $candidates = @(Get-TurboReleaseCandidates -Release $release)
    $workingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('Turbo_ffmpegger_update_' + [Guid]::NewGuid().ToString('N'))
    $archivePath = Join-Path $workingRoot 'package.zip'
    $extractionRoot = Join-Path $workingRoot 'extracted'
    $backupRoot = Join-Path $workingRoot 'backup'
    $selectedCandidate = $null
    $payloadRoot = $null
    $candidateErrors = New-Object System.Collections.Generic.List[string]
    $keepWorkingRoot = $false

    New-Item -ItemType Directory -Path $workingRoot -Force -ErrorAction Stop | Out-Null
    New-Item -ItemType Directory -Path $backupRoot -Force -ErrorAction Stop | Out-Null

    try {
        foreach ($candidate in $candidates) {
            if (Test-Path -LiteralPath $archivePath -PathType Leaf) {
                Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
            }
            if (Test-Path -LiteralPath $extractionRoot -PathType Container) {
                Remove-Item -LiteralPath $extractionRoot -Recurse -Force -ErrorAction SilentlyContinue
            }

            $downloadFields = New-TurboStatusFields -State 'downloading' -RequestedAction 'Install' -ResolvedCurrentVersion $CurrentVersion -Message "Downloading $($candidate.Name)..."
            $downloadFields['latestVersion'] = $ExpectedTag
            $downloadFields['tag'] = $ExpectedTag
            $downloadFields['packageKind'] = $candidate.Kind
            $downloadFields['packageName'] = $candidate.Name
            Write-TurboUpdateStatus -Path $StatusPath -Fields $downloadFields

            try {
                Invoke-TurboDownload -Uri $candidate.Url -Destination $archivePath
                if (-not [string]::IsNullOrWhiteSpace([string]$candidate.Digest)) {
                    if ([string]$candidate.Digest -notmatch '^(?i)sha256:([0-9a-f]{64})$') {
                        throw 'The named release asset has an unsupported or malformed digest.'
                    }
                    $expectedDigest = $Matches[1].ToLowerInvariant()
                    if ((Get-TurboFileHash -Path $archivePath) -ne $expectedDigest) {
                        throw 'The downloaded package did not match the SHA-256 digest published by GitHub.'
                    }
                }

                Expand-TurboSafeZip -ZipPath $archivePath -Destination $extractionRoot
                $payloadRoot = Find-TurboPayloadRoot -ExtractionRoot $extractionRoot
                $selectedCandidate = $candidate
                break
            }
            catch {
                $candidateErrors.Add($candidate.Name + ': ' + $_.Exception.Message)
                $payloadRoot = $null
            }
        }

        if ($null -eq $selectedCandidate -or [string]::IsNullOrWhiteSpace($payloadRoot)) {
            throw ('No release package could be used. ' + ($candidateErrors -join ' | '))
        }

        $packageFiles = @(Get-TurboPackageFiles -PayloadRoot $payloadRoot)
        $applyFields = New-TurboStatusFields -State 'installing' -RequestedAction 'Install' -ResolvedCurrentVersion $CurrentVersion -Message "Installing Turbo ffmpegger $ExpectedTag..."
        $applyFields['latestVersion'] = $ExpectedTag
        $applyFields['tag'] = $ExpectedTag
        $applyFields['packageKind'] = $selectedCandidate.Kind
        $applyFields['packageName'] = $selectedCandidate.Name
        Write-TurboUpdateStatus -Path $StatusPath -Fields $applyFields

        # The HTA closes immediately after launching this temporary worker. Wait
        # for that exact mshta parent when detectable, with a short grace fallback.
        Wait-TurboParentHtaExit

        try {
            $installResult = Install-TurboPayload -AppRoot $AppRoot -PackageFiles $packageFiles -ReleaseTag $ExpectedTag -BackupRoot $backupRoot
        }
        catch {
            if ($_.Exception.Data.Contains('TurboRollbackSucceeded') -and -not [bool]$_.Exception.Data['TurboRollbackSucceeded']) {
                $keepWorkingRoot = $true
                $_.Exception.Data['TurboRecoveryBackupPath'] = $backupRoot
            }
            throw
        }

        $restartSucceeded = $true
        $restartError = ''
        try {
            Start-TurboLauncher -AppRoot $AppRoot
        }
        catch {
            $restartSucceeded = $false
            $restartError = ConvertTo-TurboStatusValue -Value $_.Exception.Message
        }

        $successMessage = "Turbo ffmpegger was updated successfully to $ExpectedTag."
        if (-not [string]::IsNullOrWhiteSpace([string]$installResult.PresetsBackupPath)) {
            $successMessage += " Your previous built-in presets were saved to $($installResult.PresetsBackupPath)."
        }
        if (-not $restartSucceeded) {
            $successMessage += ' The automatic restart did not work; please open Launcher.bat manually.'
        }

        $successFields = New-TurboStatusFields -State 'installed' -RequestedAction 'Install' -ResolvedCurrentVersion $ExpectedTag -Message $successMessage
        $successFields['version'] = $ExpectedTag
        $successFields['latestVersion'] = $ExpectedTag
        $successFields['tag'] = $ExpectedTag
        $successFields['packageKind'] = $selectedCandidate.Kind
        $successFields['packageName'] = $selectedCandidate.Name
        $successFields['changedFiles'] = $installResult.ChangedCount
        $successFields['removedFiles'] = $installResult.RemovedCount
        $successFields['managedFiles'] = $installResult.ManagedCount
        $successFields['restartSucceeded'] = $restartSucceeded
        if (-not [string]::IsNullOrWhiteSpace([string]$installResult.PresetsBackupPath)) {
            $successFields['presetsBackupPath'] = $installResult.PresetsBackupPath
        }
        if (-not $restartSucceeded) {
            $successFields['restartError'] = $restartError
        }
        try {
            Write-TurboUpdateStatus -Path $StatusPath -Fields $successFields
        }
        catch {
            # The application files are already committed; a disposable status
            # file must not turn a successful installation into a failure.
        }

        if ($restartSucceeded) {
            Show-TurboUpdateMessage -Title 'Turbo ffmpegger update' -Message $successMessage
        }
        else {
            Show-TurboUpdateMessage -Title 'Turbo ffmpegger was updated' -Message ($successMessage + "`r`n`r`nRestart detail: " + $restartError) -IsError
        }
        return $installResult
    }
    finally {
        if (-not $keepWorkingRoot -and (Test-Path -LiteralPath $workingRoot -PathType Container)) {
            try {
                Invoke-TurboWithRetry -Description 'Cleaning up update files' -Attempts 4 -Operation {
                    Remove-Item -LiteralPath $workingRoot -Recurse -Force -ErrorAction Stop
                }
            }
            catch {
                # Cleanup failure does not undo a verified installation.
            }
        }
    }
}

function Remove-TurboTemporaryWorker {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ResolvedAppRoot
    )

    if ([string]::IsNullOrWhiteSpace($PSCommandPath)) { return }

    try {
        $scriptPath = Get-TurboFullPath -Path $PSCommandPath
        if (Test-TurboPathIsWithin -Path $scriptPath -Root $ResolvedAppRoot) {
            return
        }

        if (Test-Path -LiteralPath $scriptPath -PathType Leaf) {
            Invoke-TurboWithRetry -Description 'Removing the temporary updater worker' -Attempts 4 -Operation {
                Remove-Item -LiteralPath $scriptPath -Force -ErrorAction Stop
            }
        }
    }
    catch {
        # The worker lives outside the application and is safe to leave for OS cleanup.
    }
}

function Remove-TurboTemporaryStatusFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ResolvedAppRoot,

        [Parameter(Mandatory = $true)]
        [string]$ResolvedStatusPath
    )

    try {
        $statusPath = Get-TurboFullPath -Path $ResolvedStatusPath
        if (Test-TurboPathIsWithin -Path $statusPath -Root $ResolvedAppRoot) {
            return
        }

        if (Test-Path -LiteralPath $statusPath -PathType Leaf) {
            Invoke-TurboWithRetry -Description 'Removing the temporary update status file' -Attempts 4 -Operation {
                Remove-Item -LiteralPath $statusPath -Force -ErrorAction Stop
            }
        }
    }
    catch {
        # A random status file in the system temporary folder is non-critical.
    }
}

function Invoke-TurboUpdater {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Check', 'Install')]
        [string]$Action,

        [string]$AppRoot = '',
        [string]$CurrentVersion = '',
        [string]$StatusPath = '',
        [string]$ExpectedTag = ''
    )

    $resolvedRoot = $null
    $resolvedStatus = $null
    $resolvedCurrent = $CurrentVersion
    try {
        $resolvedRoot = Resolve-TurboAppRoot -RequestedRoot $AppRoot
        $resolvedStatus = Resolve-TurboStatusPath -RequestedPath $StatusPath -ResolvedAppRoot $resolvedRoot
        $resolvedCurrent = Resolve-TurboCurrentVersion -RequestedVersion $CurrentVersion -AppRoot $resolvedRoot

        if ($Action -eq 'Check') {
            return Invoke-TurboCheck -AppRoot $resolvedRoot -CurrentVersion $resolvedCurrent -StatusPath $resolvedStatus
        }

        return Invoke-TurboInstall -AppRoot $resolvedRoot -CurrentVersion $resolvedCurrent -StatusPath $resolvedStatus -ExpectedTag $ExpectedTag
    }
    catch {
        $caughtError = $_
        $errorMessage = ConvertTo-TurboStatusValue -Value $_.Exception.Message
        if ($errorMessage.Length -gt 1000) {
            $errorMessage = $errorMessage.Substring(0, 1000)
        }

        $safeToRestart = $true
        if ($caughtError.Exception.Data.Contains('TurboSafeToRestart')) {
            $safeToRestart = [bool]$caughtError.Exception.Data['TurboSafeToRestart']
        }
        $recoveryBackupPath = ''
        if ($caughtError.Exception.Data.Contains('TurboRecoveryBackupPath')) {
            $recoveryBackupPath = [string]$caughtError.Exception.Data['TurboRecoveryBackupPath']
        }
        $presetsBackupPath = ''
        if ($caughtError.Exception.Data.Contains('TurboPresetsBackupPath')) {
            $presetsBackupPath = [string]$caughtError.Exception.Data['TurboPresetsBackupPath']
        }

        $displayMessage = "The update could not be installed.`r`n`r`n" + $errorMessage
        if (-not [string]::IsNullOrWhiteSpace($recoveryBackupPath)) {
            $displayMessage += "`r`n`r`nAutomatic rollback was incomplete. Recovery files were preserved here:`r`n" + $recoveryBackupPath
        }
        if (-not [string]::IsNullOrWhiteSpace($presetsBackupPath)) {
            $displayMessage += "`r`n`r`nYour previous built-in presets are backed up here:`r`n" + $presetsBackupPath
        }

        if (-not [string]::IsNullOrWhiteSpace($resolvedStatus)) {
            try {
                $errorFields = New-TurboStatusFields -State 'error' -RequestedAction $Action -ResolvedCurrentVersion $resolvedCurrent -Message $errorMessage
                $errorFields['error'] = $errorMessage
                if (-not [string]::IsNullOrWhiteSpace($ExpectedTag)) {
                    $errorFields['latestVersion'] = $ExpectedTag
                    $errorFields['tag'] = $ExpectedTag
                }
                if (-not [string]::IsNullOrWhiteSpace($recoveryBackupPath)) {
                    $errorFields['recoveryBackupPath'] = $recoveryBackupPath
                    $errorFields['rollbackSucceeded'] = $false
                }
                if (-not [string]::IsNullOrWhiteSpace($presetsBackupPath)) {
                    $errorFields['presetsBackupPath'] = $presetsBackupPath
                }
                Write-TurboUpdateStatus -Path $resolvedStatus -Fields $errorFields
            }
            catch {
                # Preserve the original update error if the status file is not writable.
            }
        }

        if ($Action -eq 'Install') {
            Show-TurboUpdateMessage -Title 'Turbo ffmpegger update failed' -Message $displayMessage -IsError
            if ($safeToRestart -and -not [string]::IsNullOrWhiteSpace($resolvedRoot)) {
                try {
                    Start-TurboLauncher -AppRoot $resolvedRoot
                }
                catch {
                    Show-TurboUpdateMessage -Title 'Turbo ffmpegger could not restart' -Message ("Your previous installation was restored, but Launcher.bat could not be opened automatically.`r`n`r`n" + $_.Exception.Message) -IsError
                }
            }
        }
        throw $caughtError
    }
    finally {
        if ($Action -eq 'Install' -and -not [string]::IsNullOrWhiteSpace($resolvedRoot)) {
            if (-not [string]::IsNullOrWhiteSpace($resolvedStatus)) {
                Remove-TurboTemporaryStatusFile -ResolvedAppRoot $resolvedRoot -ResolvedStatusPath $resolvedStatus
            }
            Remove-TurboTemporaryWorker -ResolvedAppRoot $resolvedRoot
        }
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    if ([string]::IsNullOrWhiteSpace($Action)) {
        Write-Error 'Action must be Check or Install.'
        exit 2
    }

    try {
        Invoke-TurboUpdater -Action $Action -AppRoot $AppRoot -CurrentVersion $CurrentVersion -StatusPath $StatusPath -ExpectedTag $ExpectedTag | Out-Null
        exit 0
    }
    catch {
        Write-Error $_
        exit 1
    }
}
