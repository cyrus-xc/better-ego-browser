$ErrorActionPreference = 'Stop'
$egoCli = $env:EGO_BROWSER_CLI
if (-not $egoCli) { $egoCli = Join-Path $env:USERPROFILE '.local\share\ego\active_version_dir\ego-browser.exe' }
if (-not (Test-Path -LiteralPath $egoCli -PathType Leaf)) { throw 'Official ego-browser.exe not found.' }
$daemon = Join-Path (Split-Path -Parent $egoCli) 'local-ego-daemon\index.mjs'
if (-not (Test-Path -LiteralPath $daemon -PathType Leaf)) { throw 'Official daemon not found next to ego-browser.exe.' }
$base = if ($env:EGO_HOME) { $env:EGO_HOME } else { Join-Path $env:USERPROFILE '.ego' }
$stateFile = Join-Path $base 'userdata\server-runtime.json'
if (Test-Path -LiteralPath $stateFile) {
    $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    if (Get-Process -Id $state.pid -ErrorAction SilentlyContinue) {
        Write-Output "An Ego daemon is already running at $($state.origin)."
        exit 0
    }
}
$env:EGO_BROWSER_CLI = $egoCli
$node = (Get-Command node.exe).Source
$log = Join-Path $env:TEMP 'dsh-ego-official-daemon.log'
$errLog = Join-Path $env:TEMP 'dsh-ego-official-daemon.err.log'
$proc = Start-Process -FilePath $node -ArgumentList @(('"' + $daemon + '"'), '--no-auto-bootstrap-project-from-cwd', '--no-browser') -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $errLog -PassThru
Write-Output "Started official Ego daemon (PID $($proc.Id)). Logs: $log"
