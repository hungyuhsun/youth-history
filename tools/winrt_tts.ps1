# 以 Windows 內建語音（OneCore：Yating / Zhiwei / Hanhan）產生 WAV 檔
# 用法：powershell -File winrt_tts.ps1 -Jobs jobs.json -Voice Yating -Rate 1.0
# jobs.json 格式：[{ "text": "...", "path": "C:\\...\\xxx.wav" }, ...]（UTF-8）
param(
  [Parameter(Mandatory = $true)][string]$Jobs,
  [string]$Voice = 'Yating',
  [double]$Rate = 1.0
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $null = $task.Wait(-1)
  $task.Result
}

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -like "*$Voice*" } | Select-Object -First 1
if (-not $v) { throw "找不到語音：$Voice" }
$synth.Voice = $v
$synth.Options.SpeakingRate = $Rate

$list = Get-Content -Raw -Encoding UTF8 $Jobs | ConvertFrom-Json
foreach ($job in $list) {
  $stream = Await ($synth.SynthesizeTextToStreamAsync($job.text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  $null = Await ($reader.LoadAsync([uint32]$stream.Size)) ([uint32])
  $bytes = New-Object byte[] ([int]$stream.Size)
  $reader.ReadBytes($bytes)
  [IO.File]::WriteAllBytes($job.path, $bytes)
  $reader.Dispose(); $stream.Dispose()
}
Write-Output "OK $($list.Count)"
