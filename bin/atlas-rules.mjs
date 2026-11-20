import fs from "node:fs";
import path from "node:path";

export function keepFile(rel) {
  const norm = String(rel || "").replace(/\\/g, "/");
  if (!norm || norm.split("/").some((part) => part.startsWith("."))) return false;
  if (/(^|\/)(test|corpus)\//.test(norm)) return false;
  if (norm.endsWith("package.json") || norm.endsWith("package-lock.json")) return false;
  return norm.endsWith(".md") || norm.endsWith(".json");
}

export function listSkillFiles(rootDir) {
  const acc = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "images") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const rel = path.relative(rootDir, full).replace(/\\/g, "/");
        if (keepFile(rel)) acc.push(full);
      }
    }
  }
  walk(rootDir);
  return acc;
}

export function chooseGroup(groups, edges, id, hasModes) {
  const indexes = groups.map((group, index) => group.includes(id) ? index : -1).filter((index) => index >= 0);
  if (!indexes.length) return null;
  if (!hasModes) return indexes[0];
  const rooted = indexes.find((index) => groups[index][0] === id);
  if (rooted != null) return rooted;
  const neighbors = new Set();
  for (const edge of edges) {
    if (edge.from === id) neighbors.add(edge.to);
    if (edge.to === id) neighbors.add(edge.from);
  }
  let best = indexes[0];
  let bestScore = -1;
  for (const index of indexes) {
    const group = groups[index];
    const hits = [...neighbors].filter((other) => group.includes(other)).length;
    const score = hits * 1000 - group.length;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  }
  return best;
}
