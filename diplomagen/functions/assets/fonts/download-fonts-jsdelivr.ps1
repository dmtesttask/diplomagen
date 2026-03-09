$fontsDir = $PSScriptRoot
$base = "https://cdn.jsdelivr.net/gh/google/fonts"

$downloads = @(
  @{d="PTSerif"; f="PTSerif-Regular.ttf";       u="$base/ofl/ptserif/PTSerif-Regular.ttf"},
  @{d="PTSerif"; f="PTSerif-Bold.ttf";           u="$base/ofl/ptserif/PTSerif-Bold.ttf"},
  @{d="PTSerif"; f="PTSerif-Italic.ttf";         u="$base/ofl/ptserif/PTSerif-Italic.ttf"},
  @{d="PTSerif"; f="PTSerif-BoldItalic.ttf";     u="$base/ofl/ptserif/PTSerif-BoldItalic.ttf"},
  @{d="PTSans";  f="PTSans-Regular.ttf";         u="$base/ofl/ptsans/PTSans-Regular.ttf"},
  @{d="PTSans";  f="PTSans-Bold.ttf";            u="$base/ofl/ptsans/PTSans-Bold.ttf"},
  @{d="PTSans";  f="PTSans-Italic.ttf";          u="$base/ofl/ptsans/PTSans-Italic.ttf"},
  @{d="PTSans";  f="PTSans-BoldItalic.ttf";      u="$base/ofl/ptsans/PTSans-BoldItalic.ttf"},
  @{d="Roboto";  f="Roboto-Regular.ttf";         u="$base/apache/roboto/static/Roboto-Regular.ttf"},
  @{d="Roboto";  f="Roboto-Bold.ttf";            u="$base/apache/roboto/static/Roboto-Bold.ttf"},
  @{d="Roboto";  f="Roboto-Italic.ttf";          u="$base/apache/roboto/static/Roboto-Italic.ttf"},
  @{d="Roboto";  f="Roboto-BoldItalic.ttf";      u="$base/apache/roboto/static/Roboto-BoldItalic.ttf"},
  @{d="OpenSans"; f="OpenSans-Regular.ttf";      u="$base/apache/opensans/static/OpenSans-Regular.ttf"},
  @{d="OpenSans"; f="OpenSans-Bold.ttf";         u="$base/apache/opensans/static/OpenSans-Bold.ttf"},
  @{d="OpenSans"; f="OpenSans-Italic.ttf";       u="$base/apache/opensans/static/OpenSans-Italic.ttf"},
  @{d="OpenSans"; f="OpenSans-BoldItalic.ttf";   u="$base/apache/opensans/static/OpenSans-BoldItalic.ttf"},
  @{d="TimesNewRoman"; f="times.ttf";            u="https://cdn.jsdelivr.net/gh/microsoft/fonts/Times%20New%20Roman.ttf"},
  @{d="TimesNewRoman"; f="timesbd.ttf";          u="https://cdn.jsdelivr.net/gh/microsoft/fonts/Times%20New%20Roman%20Bold.ttf"}
)

foreach ($item in $downloads) {
  $dir = Join-Path $fontsDir $item.d
  if (!(Test-Path $dir)) { New-Item -ItemType Directory $dir | Out-Null }
  $dest = Join-Path $dir $item.f
  if (Test-Path $dest) { Write-Host "SKIP $($item.f)"; continue }
  try {
    $resp = Invoke-WebRequest -Uri $item.u -OutFile $dest -UseBasicParsing -TimeoutSec 30 -PassThru
    Write-Host "OK   $($item.f)  $([math]::Round((Get-Item $dest).Length/1024))KB  status=$($resp.StatusCode)"
  } catch {
    Write-Host "FAIL $($item.f): $($_.Exception.Message)"
    if (Test-Path $dest) { Remove-Item $dest }
  }
}

Write-Host "`nResult:"
Get-ChildItem -Recurse $fontsDir -Filter *.ttf | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1024)}}
