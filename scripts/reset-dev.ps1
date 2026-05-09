<#
.SYNOPSIS
  Hard-reset the local Next.js dev environment.

.DESCRIPTION
  Safe by default: only kills processes listening on dev ports
  (3000-3010) plus their child workers (next-render-worker, etc.),
  then clears `.next` and `node_modules/.cache`. Leaves Cursor's
  internal Node / language-server processes untouched.

  Pass -Aggressive to also kill any node process whose command
  line mentions `next` (use when something is hung off-port).

.PARAMETER Ports
  Ports to free. Defaults to 3000-3010.

.PARAMETER KeepNodeModulesCache
  Skip clearing `node_modules/.cache` (faster).

.PARAMETER Aggressive
  Also kill any `node` process whose command line references `next`
  or `forge-tower-explorer`. Use only if a normal reset misses a
  zombie dev server.

.EXAMPLE
  ./scripts/reset-dev.ps1
  ./scripts/reset-dev.ps1 -Ports 3000,4000
  ./scripts/reset-dev.ps1 -Aggressive
  npm run dev:reset
#>

[CmdletBinding()]
param(
  [int[]] $Ports = @(3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010),
  [switch] $KeepNodeModulesCache,
  [switch] $Aggressive
)

$ErrorActionPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$projectName = Split-Path -Leaf $projectRoot

function Write-Section([string] $label) {
  Write-Host ""
  Write-Host "> $label" -ForegroundColor Magenta
}

function Get-DescendantPids([int] $rootPid) {
  $all = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
  if (-not $all) { return @() }
  $children = @{}
  foreach ($p in $all) {
    $parent = [int]$p.ParentProcessId
    if (-not $children.ContainsKey($parent)) { $children[$parent] = @() }
    $children[$parent] += [int]$p.ProcessId
  }
  $result = New-Object System.Collections.Generic.HashSet[int]
  $stack = New-Object System.Collections.Stack
  $stack.Push($rootPid)
  while ($stack.Count -gt 0) {
    $current = $stack.Pop()
    if ($children.ContainsKey($current)) {
      foreach ($childPid in $children[$current]) {
        if ($result.Add($childPid)) { $stack.Push($childPid) }
      }
    }
  }
  return @($result)
}

function Stop-Pid([int] $procId, [string] $reason) {
  $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if (-not $proc) { return $false }
  Write-Host "  killing PID $procId ($($proc.ProcessName)) - $reason" -ForegroundColor Yellow
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  return $true
}

# 1. Find processes bound to dev ports + their descendants
Write-Section "Freeing dev ports ($($Ports -join ', '))"
$targets = New-Object System.Collections.Generic.HashSet[int]
foreach ($port in $Ports) {
  $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  if (-not $conns) { continue }
  foreach ($conn in $conns) {
    $rootPid = [int]$conn.OwningProcess
    if ($rootPid -le 0) { continue }
    if ($targets.Add($rootPid)) {
      Write-Host "  port $port -> PID $rootPid" -ForegroundColor DarkYellow
    }
    foreach ($childPid in Get-DescendantPids $rootPid) {
      if ($targets.Add($childPid)) {
        Write-Host "    + child PID $childPid" -ForegroundColor DarkGray
      }
    }
  }
}

if ($targets.Count -eq 0) {
  Write-Host "  no listeners on configured ports" -ForegroundColor DarkGray
}

# 2. Optional: scan for stray next/dev processes by command line
if ($Aggressive) {
  Write-Section "Aggressive scan: node processes referencing 'next' / project"
  $procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue
  foreach ($p in $procs) {
    $cmd = $p.CommandLine
    if (-not $cmd) { continue }
    if ($cmd -match '\bnext\b' -or $cmd -match [regex]::Escape($projectName)) {
      $procId = [int]$p.ProcessId
      if ($targets.Add($procId)) {
        Write-Host "  match PID $procId :: $($cmd.Substring(0, [Math]::Min(120, $cmd.Length)))" -ForegroundColor DarkYellow
      }
    }
  }
}

# 3. Stop everything we collected
Write-Section "Stopping collected processes"
$killed = 0
foreach ($procId in $targets) {
  if (Stop-Pid $procId 'dev server') { $killed++ }
}
if ($killed -eq 0) {
  Write-Host "  nothing to stop" -ForegroundColor DarkGray
}
Start-Sleep -Milliseconds 500

# 4. Clear caches
Write-Section "Clearing build caches"
$paths = @(Join-Path $projectRoot '.next')
if (-not $KeepNodeModulesCache) {
  $paths += (Join-Path $projectRoot 'node_modules\.cache')
}

foreach ($path in $paths) {
  if (Test-Path $path) {
    Write-Host "  removing $path" -ForegroundColor Yellow
    Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
    if (Test-Path $path) {
      Start-Sleep -Seconds 1
      Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
    }
    if (Test-Path $path) {
      Write-Host "  WARN: could not fully remove $path (file lock?)" -ForegroundColor Red
    } else {
      Write-Host "  cleared" -ForegroundColor Green
    }
  } else {
    Write-Host "  $path (not present)" -ForegroundColor DarkGray
  }
}

# 5. Verify
Write-Section "Verification"
$stillBusy = @()
foreach ($port in $Ports) {
  if (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue) {
    $stillBusy += $port
  }
}
if ($stillBusy.Count -gt 0) {
  Write-Host "  ports still in use: $($stillBusy -join ', ')" -ForegroundColor Red
} else {
  Write-Host "  all configured ports are free" -ForegroundColor Green
}

Write-Host ""
Write-Host "Reset complete. Run 'npm run dev' when ready." -ForegroundColor Cyan
