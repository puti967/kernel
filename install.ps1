$ErrorActionPreference = "Stop"
$prefix = Join-Path $env:USERPROFILE ".kernel"
$base = "https://raw.githubusercontent.com/puti967/kernel/main"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "需要 Node.js 18 或更新版本"
}
$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 18) {
  throw "需要 Node.js 18 或更新版本，当前是 $(node -v)"
}

New-Item -ItemType Directory -Force -Path (Join-Path $prefix "bin"), (Join-Path $prefix "viewer") | Out-Null

function Fetch($rel, $dest) {
  Invoke-WebRequest -UseBasicParsing -Uri "$base/$rel" -OutFile $dest
}

Fetch "bin/kernel.mjs" (Join-Path $prefix "bin\kernel.mjs")
Fetch "bin/atlas-rules.mjs" (Join-Path $prefix "bin\atlas-rules.mjs")
Fetch "viewer/index.html" (Join-Path $prefix "viewer\index.html")

$skill = @'
---
name: kernel
description: Generate a Kernel card map from a local skill directory and open the viewer. Use when the user runs /kernel or asks to map a skill repository. Works in Claude Code, Codex, Cursor, Grok, and other agents that read Agent Skills.
user-invocable: true
argument-hint: "[source directory]"
---

# Kernel

Generate the card map and open it. Do not redraw the page.

## Command

The user must name a skill directory. On Windows, from any working directory:

```powershell
node "$env:USERPROFILE\.kernel\bin\kernel.mjs" <that directory>
```

On macOS or Linux:

```bash
node "$HOME/.kernel/bin/kernel.mjs" <that directory>
```

Do not invent a directory. If the user did not name one, ask for it. Add `--no-open` when a later step must open the page itself.

## Done

The command prints a `page` path. That file must exist and load `atlas-data.js` beside it. Open that file if the command did not. A run that does not leave `pages/<name>/index.html` is not done.

## Rules

- Do not call a model to group files. The script groups from citations in the files.
- Do not edit the viewer to fit one repository.
- Do not replace the generated page with a new design.
'@

$utf8 = New-Object System.Text.UTF8Encoding $false
foreach ($rel in @(
  ".agents\skills\kernel",
  ".claude\skills\kernel",
  ".codex\skills\kernel",
  ".cursor\skills\kernel",
  ".grok\skills\kernel"
)) {
  $dir = Join-Path $env:USERPROFILE $rel
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $dir "SKILL.md"), $skill.Replace("`r`n", "`n"), $utf8)
}

Write-Output "已安装。新开一个对话后执行：/kernel /path/to/skill"
