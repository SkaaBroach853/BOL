param([string]$Text='Suresh credit forty rupees.', [string]$Output='data\local-speech-smoke.wav')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $taskPath = Join-Path (Get-Location) $Output
    [System.IO.Directory]::CreateDirectory((Split-Path -Parent $taskPath)) | Out-Null
    $taskSynth.SetOutputToWaveFile($taskPath)
    $taskSynth.Speak($Text)
} finally { $taskSynth.Dispose() }
