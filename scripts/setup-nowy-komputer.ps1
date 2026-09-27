# Konfiguracja nowego komputera do pracy nad Sztabem i stroną Scanovy.
# Uruchom z folderu "Sztab Scanova":  powershell -ExecutionPolicy Bypass -File scripts\setup-nowy-komputer.ps1
# Dwa kroki wymagają kliknięcia w przeglądarce (GitHub, Vercel) — skrypt pokaże kod/link.

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath("Desktop")
Set-Location $root

function Step($t) { Write-Host "`n=== $t" -ForegroundColor Cyan }

Step "1/7 Narzędzia (winget): Git, GitHub CLI, Node LTS"
foreach ($id in "Git.Git", "GitHub.cli", "OpenJS.NodeJS.LTS") {
  winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements | Out-Null
}
$env:Path += ";C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;C:\Program Files\nodejs"
git --version; gh --version | Select-Object -First 1; node -v

Step "2/7 Logowanie do GitHuba (otworzy przeglądarkę)"
if (-not (gh auth status 2>$null)) { gh auth login --web -h github.com -p https }
gh auth setup-git
git config --global user.name "AdamKond"
git config --global user.email "absolusq@gmail.com"

Step "3/7 Pozostałe repozytoria na Pulpicie"
$repos = @{ "scanova-tech" = "Scanova Strona"; "SERCEMAMY" = "Serce Mamy"; "ai-recepcjonista" = "AI Recepcjonista" }
foreach ($r in $repos.Keys) {
  $t = Join-Path $desktop $repos[$r]
  if (Test-Path $t) { "jest: $t" } else { gh repo clone "AdamKond/$r" "$t" }
}

Step "4/7 Zależności Sztabu"
npm install

Step "5/7 Vercel: logowanie, link projektu, klucze do .env.local (otworzy przeglądarkę)"
npx --yes vercel@latest login
npx --yes vercel@latest link --yes --project sztab-scanova
npx --yes vercel@latest env pull .env.local --environment=development --yes
$site = Join-Path $desktop "Scanova Strona"
if (Test-Path $site) { Push-Location $site; npx --yes vercel@latest link --yes --project scanova-tech; Pop-Location }

Step "6/7 Pamięć Claude'a (docs/pamiec → ~/.claude)"
$mem = Join-Path $env:USERPROFILE ".claude\projects\C--Users-Adam\memory"
New-Item -ItemType Directory -Force $mem | Out-Null
Copy-Item (Join-Path $root "docs\pamiec\*") $mem -Force
"skopiowano do $mem"

Step "7/7 Sprawdzenie"
npm run typecheck
Write-Host "`nGotowe. Uruchom: npm run dev  →  http://localhost:3000" -ForegroundColor Green
Write-Host "Potem w Claude: 'czytaj docs/START.md'." -ForegroundColor Green
