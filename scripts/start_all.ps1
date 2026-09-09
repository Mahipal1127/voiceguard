# Start both VOICEGUARD dev servers in background processes.
# (PowerShell: right-click -> Run with PowerShell, or run from repo root:
#  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start_all.ps1)
$root = Split-Path $PSScriptRoot -Parent

Start-Process -FilePath (Join-Path $root "backend\.venv\Scripts\python.exe") `
  -ArgumentList "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000" `
  -WorkingDirectory (Join-Path $root "backend") `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $root "uvicorn.log") `
  -RedirectStandardError (Join-Path $root "uvicorn.err.log")

Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c", "npm run dev > ..\vite-dev.log 2>&1" `
  -WorkingDirectory (Join-Path $root "frontend") `
  -WindowStyle Hidden

Write-Host "VOICEGUARD starting:"
Write-Host "  backend  -> http://127.0.0.1:8000/health"
Write-Host "  frontend -> http://localhost:5173"
