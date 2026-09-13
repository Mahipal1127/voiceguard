# Phase 5 verification — TTS clips should score HIGH on AI-voice risk.
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
"log start" | Out-File phase5-test.log

Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice("Microsoft Zira Desktop")
$s.SetOutputToWaveFile("$root\tts_probe1.wav")
$s.Speak("I am your CEO. Transfer five lakh immediately. I am busy, so do not call me back.")
$s.Dispose()
$s2 = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s2.SelectVoice("Microsoft David Desktop")
$s2.SetOutputToWaveFile("$root\tts_probe2.wav")
$s2.Speak("Hey, can you send me the meeting notes from this afternoon when you get a chance?")
$s2.Dispose()
"clips: p1=$(Test-Path tts_probe1.wav) p2=$(Test-Path tts_probe2.wav)" | Out-File -Append phase5-test.log

Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Start-Process -FilePath "backend\.venv\Scripts\python.exe" `
  -ArgumentList "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000" `
  -WorkingDirectory "backend" -WindowStyle Hidden `
  -RedirectStandardOutput "uvicorn.log" -RedirectStandardError "uvicorn.err.log"
Start-Sleep -Seconds 5
"backend restarted" | Out-File -Append phase5-test.log

# warmup — first call downloads the wav2vec2 model (~360 MB) to models_store/hf-cache
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$warm = curl.exe -s --max-time 1200 -X POST "http://127.0.0.1:8000/warmup"
$sw.Stop()
"warmup: $warm ($([math]::Round($sw.Elapsed.TotalSeconds,1)) s)" | Out-File -Append phase5-test.log

$sw1 = [System.Diagnostics.Stopwatch]::StartNew()
$code1 = curl.exe -s -o analyze-tts1.json -w "%{http_code}" -F "file=@tts_probe1.wav;type=audio/wav" "http://127.0.0.1:8000/analyze"
$sw1.Stop()
"tts1 (Zira) HTTP: $code1 in $([math]::Round($sw1.Elapsed.TotalSeconds,2)) s" | Out-File -Append phase5-test.log

$sw2 = [System.Diagnostics.Stopwatch]::StartNew()
$code2 = curl.exe -s -o analyze-tts2.json -w "%{http_code}" -F "file=@tts_probe2.wav;type=audio/wav" "http://127.0.0.1:8000/analyze"
$sw2.Stop()
"tts2 (David) HTTP: $code2 in $([math]::Round($sw2.Elapsed.TotalSeconds,2)) s" | Out-File -Append phase5-test.log

Set-Location frontend
npm run build 2>&1 | Out-File ..\frontend-build5.log
"frontend build exit: $LASTEXITCODE" | Out-File -Append ..\phase5-test.log
Set-Location $root
"PHASE5-TEST-DONE" | Out-File -Append phase5-test.log
