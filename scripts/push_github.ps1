# One-time GitHub push helper.
# Usage:  powershell -File scripts\push_github.ps1 https://github.com/<you>/voiceguard.git
# The first push opens a GitHub sign-in window (Git Credential Manager) —
# approve it once and the credentials are cached for future pushes.
param([Parameter(Mandatory = $true)][string]$RepoUrl)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

git remote remove origin 2>$null
git remote add origin $RepoUrl
git push -u origin main

Write-Host ""
Write-Host "Pushed to $RepoUrl (branch: main)"
