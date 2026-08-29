<#
    بصائرنا — خادم محلي للتجربة
    A static file server for local development.

    This project has no build step and no dependencies, and the machine has
    no Node or Python, so this uses System.Net.HttpListener — part of Windows
    itself — to serve the folder over http://localhost.

    Why bother instead of opening index.html directly: browsers treat
    "localhost" as a secure origin, so serving this way turns on the features
    a file:// page cannot have —

        • the microphone, for recording voice notes
        • the service worker, for working offline
        • installing the app to the desktop or home screen

    Usage:
        powershell -ExecutionPolicy Bypass -File scripts/serve.ps1
        powershell -ExecutionPolicy Bypass -File scripts/serve.ps1 -Port 3000

    Stop it with Ctrl+C.
#>

[CmdletBinding()]
param(
    [int]$Port = 8080,
    [switch]$Open
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

$mime = @{
    '.html'       = 'text/html; charset=utf-8'
    '.htm'        = 'text/html; charset=utf-8'
    '.js'         = 'text/javascript; charset=utf-8'
    '.mjs'        = 'text/javascript; charset=utf-8'
    '.css'        = 'text/css; charset=utf-8'
    '.json'       = 'application/json; charset=utf-8'
    '.webmanifest'= 'application/manifest+json; charset=utf-8'
    '.md'         = 'text/markdown; charset=utf-8'
    '.pdf'        = 'application/pdf'
    '.svg'        = 'image/svg+xml'
    '.png'        = 'image/png'
    '.jpg'        = 'image/jpeg'
    '.jpeg'       = 'image/jpeg'
    '.gif'        = 'image/gif'
    '.webp'       = 'image/webp'
    '.ico'        = 'image/x-icon'
    '.mp3'        = 'audio/mpeg'
    '.m4a'        = 'audio/mp4'
    '.ogg'        = 'audio/ogg'
    '.opus'       = 'audio/ogg'
    '.wav'        = 'audio/wav'
    '.webm'       = 'audio/webm'
    '.woff'       = 'font/woff'
    '.woff2'      = 'font/woff2'
    '.ttf'        = 'font/ttf'
    '.txt'        = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host ""
    Write-Host "  تعذّر فتح المنفذ $Port — ربما يستخدمه برنامج آخر." -ForegroundColor Red
    Write-Host "  Could not bind port $Port. Try another one:" -ForegroundColor Red
    Write-Host "      powershell -ExecutionPolicy Bypass -File scripts/serve.ps1 -Port 8081"
    Write-Host ""
    exit 1
}

$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "  بصائرنا" -ForegroundColor Green
Write-Host "  يعمل على  $url" -ForegroundColor Cyan
Write-Host "  المجلد    $Root" -ForegroundColor DarkGray
Write-Host "  الاختبارات $($url)tests.html" -ForegroundColor DarkGray
Write-Host "  للإيقاف: Ctrl+C" -ForegroundColor DarkGray
Write-Host ""

if ($Open) { Start-Process $url }

try {
    while ($listener.IsListening) {

        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $status = 200
        try {
            $relative = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath).TrimStart('/')
            if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
            $relative = $relative -replace '/', '\'

            $target = Join-Path $Root $relative
            if (Test-Path -LiteralPath $target -PathType Container) {
                $target = Join-Path $target 'index.html'
            }

            # Never serve anything outside the project folder.
            $resolved = $null
            if (Test-Path -LiteralPath $target -PathType Leaf) {
                $resolved = (Resolve-Path -LiteralPath $target).ProviderPath
                if (-not $resolved.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
                    $resolved = $null
                    $status = 403
                }
            }

            if ($resolved) {
                $bytes = [System.IO.File]::ReadAllBytes($resolved)
                $extension = [System.IO.Path]::GetExtension($resolved).ToLowerInvariant()

                $type = $mime[$extension]
                if (-not $type) { $type = 'application/octet-stream' }

                $response.StatusCode = 200
                $response.ContentType = $type
                # Always hand back the file on disk, so an edit shows up on refresh.
                $response.Headers['Cache-Control'] = 'no-store, must-revalidate'
                $response.ContentLength64 = $bytes.Length

                if ($request.HttpMethod -ne 'HEAD') {
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
            } else {
                if ($status -ne 403) { $status = 404 }
                $body = [System.Text.Encoding]::UTF8.GetBytes("$status — $relative")
                $response.StatusCode = $status
                $response.ContentType = 'text/plain; charset=utf-8'
                $response.ContentLength64 = $body.Length
                $response.OutputStream.Write($body, 0, $body.Length)
            }
        } catch {
            $status = 500
            Write-Host "  500  $($request.Url.AbsolutePath)  $($_.Exception.Message)" -ForegroundColor Red
            try { $response.StatusCode = 500 } catch { }
        } finally {
            $colour = 'DarkGray'
            if ($status -ge 400) { $colour = 'Yellow' }
            Write-Host ("  {0}  {1}  {2}" -f $status, $request.HttpMethod, $request.Url.AbsolutePath) -ForegroundColor $colour
            try { $response.OutputStream.Close() } catch { }
        }
    }
} finally {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
    Write-Host ""
    Write-Host "  توقّف الخادم." -ForegroundColor DarkGray
}
