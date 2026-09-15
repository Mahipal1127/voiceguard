# One-time GitHub push helper.
# Usage:  powershell -File scripts\push_github.ps1 https://github.com/<you>/voiceguard.git
# The first push opens a GitHub sign-in window (Git Credential Manager) —
# approve it once and the credentials are cached for future pushes.
param([Parameter(Mandatory = $true)][string]$RepoUrl)

Set-Location (Split-Path $PSScriptRoot -Parent)

# Replace any existing origin (tolerates a fresh repo with none configured)
if (git remote | Select-String -Quiet "^origin$") { git remote remove origin }
git remote add origin $RepoUrl
git push -u origin main

Write-Host ""
Write-Host "Pushed to $RepoUrl (branch: main)"
