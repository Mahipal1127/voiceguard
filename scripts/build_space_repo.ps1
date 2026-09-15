# Assembles deploy/hf-space-repo — a clean, ready-to-upload Hugging Face Space:
# the contents of backend/ (code only: no venv, no DB, no models) + Dockerfile
# + Space README. Upload the FOLDER CONTENTS to your Space repo.
$root = Split-Path $PSScriptRoot -Parent
$dst = Join-Path $root "deploy\hf-space-repo"

if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Force $dst | Out-Null

Copy-Item (Join-Path $root "backend\requirements.txt") $dst
Copy-Item (Join-Path $root "backend\main.py") $dst
Copy-Item (Join-Path $root "backend\db.py") $dst
Copy-Item (Join-Path $root "backend\routers") (Join-Path $dst "routers") -Recurse
Copy-Item (Join-Path $root "backend\services") (Join-Path $dst "services") -Recurse

# strip caches from the copied packages
Get-ChildItem -Recurse -Force -Directory (Join-Path $dst ".") |
  Where-Object { $_.Name -eq "__pycache__" } |
  Remove-Item -Recurse -Force

Copy-Item (Join-Path $root "deploy\hf-space\Dockerfile") (Join-Path $dst "Dockerfile")
Copy-Item (Join-Path $root "deploy\hf-space-readme.md") (Join-Path $dst "README.md")

Write-Host "Space repo assembled at $dst"
Get-ChildItem -Recurse -File $dst | ForEach-Object { $_.FullName.Replace($dst, "") }
