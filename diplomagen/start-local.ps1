# DiplomaGen - local dev startup
# Usage: .\start-local.ps1

$ROOT           = $PSScriptRoot
$JAVA_HOME_PATH = "C:\Program Files\Eclipse Adoptium\jdk-25.0.2.10-hotspot"
$PORTS          = @(4000, 4200, 5001, 8080, 9099, 9199)

$env:JAVA_HOME = $JAVA_HOME_PATH
$env:PATH      = "$JAVA_HOME_PATH\bin;$env:PATH"

# --- Helper: kill all processes occupying the given ports --------------------
function Stop-OccupiedPorts {
    param([int[]]$PortList)
    foreach ($port in $PortList) {
        $lines = netstat -ano | Select-String ":$port "
        foreach ($line in $lines) {
            $parts = ($line.ToString().Trim() -split '\s+')
            $pid_  = $parts[-1]
            if ($pid_ -match '^\d+$' -and $pid_ -ne '0') {
                taskkill /T /F /PID $pid_ | Out-Null
            }
        }
    }
}

Write-Host ""
Write-Host "=== DiplomaGen Local Dev ===" -ForegroundColor Cyan
Write-Host ""

# --- Step 0: Free ports ------------------------------------------------------
Write-Host "[0/3] Checking ports $($PORTS -join ', ')..." -ForegroundColor Yellow
$busy = @()
foreach ($port in $PORTS) {
    $match = netstat -ano | Select-String ":$port "
    if ($match) { $busy += $port }
}
if ($busy.Count -gt 0) {
    Write-Host "  Busy ports: $($busy -join ', ') -- killing..." -ForegroundColor DarkYellow
    Stop-OccupiedPorts -PortList $PORTS
    Start-Sleep -Seconds 1
    Write-Host "  Ports cleared." -ForegroundColor Green
} else {
    Write-Host "  All ports free." -ForegroundColor Green
}

# --- Step 1: Build Cloud Functions -------------------------------------------
Write-Host ""
Write-Host "[1/3] Building Cloud Functions..." -ForegroundColor Yellow
Push-Location "$ROOT\functions"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Build failed." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "  OK" -ForegroundColor Green

# --- Step 2: Firebase Emulators ----------------------------------------------
Write-Host ""
Write-Host "[2/3] Starting Firebase Emulators..." -ForegroundColor Yellow
Write-Host "  Auth      -> http://localhost:9099"
Write-Host "  Firestore -> http://localhost:8080"
Write-Host "  Storage   -> http://localhost:9199"
Write-Host "  Functions -> http://localhost:5001"
Write-Host "  UI        -> http://localhost:4000"

$emulatorScript = "$env:TEMP\diplomagen-emulators.ps1"
$emulatorContent = @"
`$env:JAVA_HOME = '$JAVA_HOME_PATH'
`$env:PATH = '$JAVA_HOME_PATH\bin;' + `$env:PATH
Set-Location '$ROOT'
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
"@
Set-Content $emulatorScript -Value $emulatorContent -Encoding UTF8

$emulatorsProc = Start-Process powershell `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$emulatorScript`"" `
    -PassThru -WindowStyle Normal

# --- Step 3: Angular dev server ----------------------------------------------
Write-Host ""
Write-Host "[3/3] Starting Angular dev server..." -ForegroundColor Yellow
Write-Host "  App -> http://localhost:4200"

$angularScript = "$env:TEMP\diplomagen-angular.ps1"
$angularContent = @"
Set-Location '$ROOT\frontend'
npm start
"@
Set-Content $angularScript -Value $angularContent -Encoding UTF8

$angularProc = Start-Process powershell `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$angularScript`"" `
    -PassThru -WindowStyle Normal

# --- Ready -------------------------------------------------------------------
Write-Host ""
Write-Host "=== All services started ===" -ForegroundColor Green
Write-Host ""
Write-Host "  App URL     : http://localhost:4200" -ForegroundColor Cyan
Write-Host "  Emulator UI : http://localhost:4000" -ForegroundColor Cyan
Write-Host "  API base    : http://localhost:5001/diplomagen-dev/europe-central2/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press ENTER to stop ALL processes and exit..." -ForegroundColor DarkGray
Read-Host | Out-Null

Write-Host "Stopping..." -ForegroundColor Yellow

if ($emulatorsProc -and -not $emulatorsProc.HasExited) {
    taskkill /T /F /PID $emulatorsProc.Id | Out-Null
}
if ($angularProc -and -not $angularProc.HasExited) {
    taskkill /T /F /PID $angularProc.Id | Out-Null
}
Stop-OccupiedPorts -PortList $PORTS

Remove-Item $emulatorScript -ErrorAction SilentlyContinue
Remove-Item $angularScript  -ErrorAction SilentlyContinue
Write-Host "Done." -ForegroundColor Green
