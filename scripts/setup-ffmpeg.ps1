$ErrorActionPreference = "Stop"

$FfmpegVersion = "b6.1.1"
$FfmpegBase = "https://github.com/eugeneware/ffmpeg-static/releases/download/$FfmpegVersion"

$Arch = $env:PROCESSOR_ARCHITECTURE
switch ($Arch) {
    "AMD64" { $Triple = "x86_64-pc-windows-msvc"; $Asset = "ffmpeg-win32-x64.exe" }
    "ARM64" { $Triple = "aarch64-pc-windows-msvc"; $Asset = "ffmpeg-win32-arm64.exe" }
    default {
        Write-Error "Unsupported architecture: $Arch"
        exit 1
    }
}

$Sidecar = "src-tauri\binaries\ffmpeg-$Triple.exe"

if (Test-Path $Sidecar) {
    Write-Host "ffmpeg sidecar already exists: $Sidecar"
    exit 0
}

New-Item -ItemType Directory -Force -Path "src-tauri\binaries" | Out-Null
Write-Host "Downloading ffmpeg sidecar ($Asset)..."
Invoke-WebRequest -Uri "$FfmpegBase/$Asset" -OutFile $Sidecar
Write-Host "Done: $Sidecar"
