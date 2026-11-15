$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $taskPath = Join-Path (Get-Location) 'data\local-speech-smoke.wav'
    [System.IO.Directory]::CreateDirectory((Split-Path -Parent $taskPath)) | Out-Null
    $taskSynth.SetOutputToWaveFile($taskPath)
    $taskSynth.Speak('Suresh credit forty rupees.')
} finally { $taskSynth.Dispose() }
