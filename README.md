# Kernel

Visualize an agent skill, or any unfamiliar document set, as architecture cards. Kernel shows where to start, what to read next, and why the author connected one file to another.

You do not need to guess the outline. A citation in the text is a connection. A file with no citation is still its own card.

## Who it is for

Use Kernel when you open someone else's agent skill, `SKILL.md`, or a folder of docs and do not know the reading order.

It is a local Node.js tool. It writes one HTML page. It does not call a model to split files.

## Features

- Parse a skill directory into architecture cards
- Build a reading order from citations, not from a guessed outline
- Keep uncited files as their own cards, outside the entry reading group
- Mark a fan-out as a menu when the files are parallel, not a numbered sequence
- Click a color marker to show one route, and only that route's lines
- Open the generated page in a browser and read the original markdown

## Quick start

Requires Node.js 18 or newer.

```bash
git clone https://github.com/puti967/kernel.git
cd kernel
node bin/kernel.mjs /path/to/skill
```

The command prints a `page` path. Open that `pages/<name>/index.html` file.

Pass `--no-open` when you do not want the page to open automatically.

A directory is a skill only when it has `SKILL.md` with `name` and `description`. Otherwise Kernel stops and does not draw a map.

## How a map is built

1. Keep `.md` and `.json` files. Skip `package.json`, `test/`, and `corpus/`.
2. A citation is a markdown link or a backtick path that resolves to a file in the skill.
3. The entry reading group contains only the files `SKILL.md` cites directly.
4. Other cited files form their own groups. A file that nothing cites becomes a single card.
5. A group is a sequence only when each next card is cited by the one before it. Otherwise the cards are a menu: read the first, then any of the others.
6. One card can sit on more than one route. The color marker selects the route. Lines outside that route turn gray.

## Example

Given a skill whose `SKILL.md` links to `references/sheet.md` and `references/spec.md`, Kernel draws three cards. The entry card is “read this first.” The two references are available next to it, without a fake step 2 and step 3, unless one file actually cites the other.

Click the entry card to see that route. Click a color marker on a card that belongs to two groups to switch routes.

## Project layout

| Path | Purpose |
| --- | --- |
| `bin/kernel.mjs` | Read a skill directory and write the card page |
| `bin/atlas-rules.mjs` | Decide which files become cards, and which route a click opens |
| `viewer/index.html` | The card page. Generated pages copy this file |

Generated pages are written to `pages/`. They are output, not source.

## License

[MIT](LICENSE)
