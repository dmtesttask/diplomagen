# Downloads Cyrillic-capable Google Fonts as TTF into the correct subfolders.
# Usage: powershell -ExecutionPolicy Bypass -File download-fonts.ps1

$oa = "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)"
$fontsDir = $PSScriptRoot

function Download-GoogleFont {
  param([string]$family, [string[]]$variants, [string]$subDir)

  $q = $variants -join ","
  $apiUrl = "https://fonts.googleapis.com/css?family=${family}:${q}"
  Write-Host "Fetching CSS for $family ..."
  try {
    $css = (Invoke-WebRequest -Uri $apiUrl -UserAgent $oa -UseBasicParsing).Content
  } catch {
    Write-Host "  FAIL css: $_"
    return
  }

  $ttfMatches = [regex]::Matches($css, "url\((.+?\.ttf)\)")
  Write-Host "  Found $($ttfMatches.Count) TTF file(s)"

  foreach ($m in $ttfMatches) {
    $url  = $m.Groups[1].Value
    $fname = [System.IO.Path]::GetFileName($url)
    $destDir = Join-Path $fontsDir $subDir
    if (!(Test-Path $destDir)) { New-Item -ItemType Directory $destDir | Out-Null }
    $dest = Join-Path $destDir $fname
    if (Test-Path $dest) { Write-Host "  SKIP $fname (exists)"; continue }
    Write-Host "  -> $fname"
    try {
      Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -TimeoutSec 30
      Write-Host "     OK $([math]::Round((Get-Item $dest).Length/1024)) KB"
    } catch {
      Write-Host "     FAIL: $_"
    }
  }
}

Download-GoogleFont "PT+Serif"  @("400","700","400italic","700italic") "PTSerif"
Download-GoogleFont "PT+Sans"   @("400","700","400italic","700italic") "PTSans"
Download-GoogleFont "Roboto"    @("400","700","400italic","700italic") "Roboto"
Download-GoogleFont "Open+Sans" @("400","700","400italic","700italic") "OpenSans"

Write-Host "`nAll done. Files:"
Get-ChildItem -Recurse $fontsDir -Filter *.ttf | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1024)}}
