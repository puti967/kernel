#!/bin/sh
set -eu

prefix="${HOME}/.kernel"
src="${KERNEL_SRC:-}"
base="https://raw.githubusercontent.com/puti967/kernel/main"

if ! command -v node >/dev/null 2>&1; then
  echo "需要 Node.js 18 或更新版本" >&2
  exit 1
fi

major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$major" -lt 18 ]; then
  echo "需要 Node.js 18 或更新版本，当前是 $(node -v)" >&2
  exit 1
fi

mkdir -p "$prefix/bin" "$prefix/viewer" "${HOME}/.agents/skills/kernel"

fetch() {
  rel="$1"
  dest="$2"
  if [ -n "$src" ]; then
    cp "$src/$rel" "$dest"
  else
    curl -fsSL "$base/$rel" -o "$dest"
  fi
}

fetch bin/kernel.mjs "$prefix/bin/kernel.mjs"
fetch bin/atlas-rules.mjs "$prefix/bin/atlas-rules.mjs"
fetch viewer/index.html "$prefix/viewer/index.html"
chmod +x "$prefix/bin/kernel.mjs"

cat > "${HOME}/.agents/skills/kernel/SKILL.md" << 'EOF'
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
EOF

skill="${HOME}/.agents/skills/kernel"
for dir in \
  "${HOME}/.claude/skills" \
  "${HOME}/.codex/skills" \
  "${HOME}/.cursor/skills" \
  "${HOME}/.grok/skills"
do
  mkdir -p "$dir"
  rm -rf "$dir/kernel"
  ln -s "$skill" "$dir/kernel"
done

echo "已安装。Claude Code、Codex、Cursor、Grok 新开一个对话后执行：/kernel /path/to/skill"
