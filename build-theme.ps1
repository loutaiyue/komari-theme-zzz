param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    if (-not $SkipBuild) {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Theme build failed.' }
    }
    $manifest = Get-Content -LiteralPath 'komari-theme.json' -Raw | ConvertFrom-Json
    if ($manifest.short -notmatch '^[a-z0-9-]+$' -or $manifest.version -notmatch '^[a-zA-Z0-9.-]+$') { throw 'Invalid package name or version.' }
    foreach ($required in @('dist/index.html', 'komari-theme.json', $manifest.preview)) {
        if (-not (Test-Path -LiteralPath $required)) { throw "Missing required theme file: $required" }
    }
    $releaseDir = Join-Path $PSScriptRoot 'release'
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
    $archivePath = Join-Path $releaseDir "$($manifest.short)-v$($manifest.version).zip"
    Compress-Archive -LiteralPath @('dist', 'komari-theme.json', $manifest.preview) -DestinationPath $archivePath -Force
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
    try {
        $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
        foreach ($required in @('dist/index.html', 'komari-theme.json', $manifest.preview)) {
            if ($entries -notcontains $required) { throw "Archive verification failed: $required" }
        }
        Write-Host "Verified $($entries.Count) entries: $archivePath"
    } finally { $archive.Dispose() }
} finally { Pop-Location }
