#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { keepFile, listSkillFiles } from "./atlas-rules.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const source = args.find((arg) => !arg.startsWith("--"));
const shouldOpen = !args.includes("--no-open");
if (!source) {
  console.error("用法: node bin/kernel.mjs <skill directory>");
  process.exit(1);
}
const palette = [
  { wash: "#f8f1e8", ink: "#6a5344", line: "#eadfce", accent: "#c4a484" },
  { wash: "#eef2f6", ink: "#45586a", line: "#d5e0ea", accent: "#8aa3b8" },
  { wash: "#f4eef6", ink: "#5c4d68", line: "#e6dce9", accent: "#b7a4c4" },
  { wash: "#eef4ef", ink: "#3f5c49", line: "#d7e6da", accent: "#9bb8a4" },
  { wash: "#eef3f8", ink: "#3e5570", line: "#d7e3ee", accent: "#9bb0c8" },
  { wash: "#f8f0ea", ink: "#6a4e42", line: "#eadfd6", accent: "#d0b2a4" },
  { wash: "#eef6f4", ink: "#3e5c58", line: "#d5e8e4", accent: "#9ec4be" },
  { wash: "#f6f3ea", ink: "#5e5644", line: "#e7e1d2", accent: "#c9bea4" },
  { wash: "#f6eef1", ink: "#644854", line: "#e8dbe1", accent: "#c9aab4" }
];

function read(file) {
  return fs.readFileSync(file, "utf8");
}
function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  const body = match ? text.slice(match[0].length).trim() : text.trim();
  const meta = {};
  if (match) {
    const lines = match[1].split("\n");
    let key = "";
    let folded = false;
    for (const line of lines) {
      const hit = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (hit) {
        key = hit[1];
        const value = hit[2].trim();
        folded = value === ">-" || value === ">" || value === "|";
        meta[key] = folded ? "" : value.replace(/^["']|["']$/g, "");
        continue;
      }
      if (folded && key && /^\s+\S/.test(line)) meta[key] = `${meta[key]} ${line.trim()}`.trim();
      else folded = false;
    }
  }
  return { meta, body };
}
function firstSentence(text) {
  const plain = text.replace(/^---[\s\S]*?---/, "").replace(/^#+\s+.*/gm, "").replace(/[`*_>#-]/g, " ").replace(/\s+/g, " ").trim();
  const sentence = (plain.split(/[。！？.!?]/)[0] || plain).trim();
  if (sentence.length <= 36) return sentence || "这份材料。";
  const cut = sentence.slice(0, 36);
  const boundary = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("，"));
  return (boundary > 16 ? cut.slice(0, boundary) : cut).trim();
}
function kindFor(rel) {
  const base = path.basename(rel);
  if (/(^|\/)SKILL\.md$/.test(rel) || rel.startsWith("skills/")) return "命令";
  if (rel.startsWith("schemas/") || base.endsWith(".schema.json")) return "原则";
  if (rel.startsWith("examples/") || rel.includes("/examples/") || rel.startsWith("playbooks/") || rel.includes("/playbooks/")) return "剧本";
  if (rel.startsWith("agents/")) return "智能体";
  if (rel.startsWith("automations/")) return "自动化";
  if (rel.endsWith(".md")) return "文档";
  return "根目录";
}
function isSkillFile(rel) {
  return rel === "SKILL.md" || rel.endsWith("/SKILL.md");
}


const rank = (rel) => /SKILL\.md$/.test(rel) ? 0 : rel.startsWith("reference") || rel.startsWith("docs") ? 1 : rel.startsWith("schemas") ? 2 : rel.startsWith("examples") ? 3 : 4;
const files = listSkillFiles(source).sort((a, b) => rank(path.relative(source, a)) - rank(path.relative(source, b)) || a.localeCompare(b));
const skillFiles = files.filter((file) => isSkillFile(path.relative(source, file)));
if (!skillFiles.length) {
  console.error("不是 skill：缺少 SKILL.md，不执行解析");
  process.exit(1);
}
const nodes = [];
const idByName = new Map();
for (const file of files) {
  const rel = path.relative(source, file);
  const base = path.basename(file, path.extname(file));
  const parent = path.basename(path.dirname(file));
  const id = rel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const text = read(file);
  const parsed = file.endsWith(".md") ? frontmatter(text) : { meta: {}, body: text };
  if (isSkillFile(rel) && (!parsed.meta.name || !parsed.meta.description)) {
    console.error(`不是 skill：${rel} 缺少 name 或 description，不执行解析`);
    process.exit(1);
  }
  const name = parsed.meta.name || base;
  idByName.set(id, id);
  idByName.set(rel.toLowerCase(), id);
  idByName.set(base.toLowerCase(), id);
  idByName.set(name.replace(/^\//, "").toLowerCase(), id);
  nodes.push({
    id,
    name,
    kind: kindFor(rel),
    blurb: firstSentence(parsed.meta.description || parsed.body || name),
    when: parsed.meta.description || "",
    path: rel,
    body: parsed.body || text
  });
}
const known = new Set([...idByName.keys()]);
const edges = [];
const seen = new Set();
function addEdge(from, to, why) {
  if (!from || !to || from === to) return;
  const stamp = `${from}->${to}`;
  if (seen.has(stamp)) return;
  seen.add(stamp);
  edges.push({ from, to, why });
}
function resolveRel(fromPath, raw) {
  let target = path.normalize(path.join(path.dirname(fromPath), raw.split("#")[0])).replace(/\\/g, "/");
  const base = path.basename(source);
  if (!fs.existsSync(path.join(source, target)) && target.startsWith(base + "/")) target = target.slice(base.length + 1);
  return fs.existsSync(path.join(source, target)) ? target : "";
}
function citations(node) {
  const found = [];
  for (const match of node.body.matchAll(/\(([^)\s]+\.(?:md|json))(?:#[^)]*)?\)|`([^`\n]+\.(?:md|json))`/g)) {
    const raw = match[1] || match[2] || "";
    if (!raw || raw.startsWith("http")) continue;
    const target = resolveRel(node.path, raw);
    if (target) found.push(target);
  }
  return found;
}
function addCited(rel) {
  const file = path.join(source, rel);
  if (!keepFile(rel) || !fs.existsSync(file) || nodes.some((node) => node.path === rel)) return;
  const base = path.basename(file, path.extname(file));
  const id = rel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const text = read(file);
  const parsed = file.endsWith(".md") ? frontmatter(text) : { meta: {}, body: text };
  idByName.set(id, id);
  idByName.set(rel.toLowerCase(), id);
  nodes.push({
    id,
    name: parsed.meta.name || base,
    kind: kindFor(rel),
    blurb: firstSentence(parsed.meta.description || parsed.body || base),
    when: parsed.meta.description || "",
    path: rel,
    body: parsed.body || text
  });
}
for (let pass = 0; pass < 4; pass += 1) {
  for (const node of nodes.slice()) {
    for (const rel of citations(node)) addCited(rel);
  }
}
for (const node of nodes) {
  for (const rel of citations(node)) addEdge(node.id, idByName.get(rel.toLowerCase()), "正文指向这份材料");
}
const groups = [];
for (const entry of nodes.filter((node) => node.path === "SKILL.md" || node.path.endsWith("/SKILL.md"))) {
  const members = [entry.id];
  for (const rel of citations(entry)) {
    const id = idByName.get(rel.toLowerCase());
    if (id && !members.includes(id)) members.push(id);
  }
  if (members.length > 1) groups.push(members);
}
for (const edge of edges) {
  if (groups.some((group) => group.includes(edge.from) && group.includes(edge.to))) continue;
  const members = [];
  const seenIds = new Set();
  const queue = [edge.from, edge.to];
  while (queue.length) {
    const id = queue.shift();
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    members.push(id);
    const already = groups.some((group) => group.includes(id) && group.length > 1);
    if (already && id !== edge.from && id !== edge.to) continue;
    for (const item of edges) {
      if (item.from === id) queue.push(item.to);
      if (item.to === id && !groups.some((group) => group.includes(item.from) && group.length > 1)) queue.push(item.from);
    }
  }
  const incomingCount = Object.fromEntries(members.map((id) => [id, 0]));
  for (const item of edges) {
    if (seenIds.has(item.from) && seenIds.has(item.to)) incomingCount[item.to] += 1;
  }
  const order = [];
  const used = new Set();
  const pendingQueue = members.filter((id) => incomingCount[id] === 0);
  if (!pendingQueue.length) pendingQueue.push(edge.from);
  while (pendingQueue.length) {
    const id = pendingQueue.shift();
    if (used.has(id)) continue;
    used.add(id);
    order.push(id);
    for (const item of edges) if (item.from === id && seenIds.has(item.to)) pendingQueue.push(item.to);
  }
  for (const id of members) if (!used.has(id)) order.push(id);
  if (order.length > 1) groups.push(order);
}
const placedInGroup = new Set(groups.flat());
const pendingIds = nodes.map((node) => node.id).filter((id) => !placedInGroup.has(id));
const pending = new Set(pendingIds);
const outs = Object.fromEntries(pendingIds.map((id) => [id, []]));
const incoming = Object.fromEntries(pendingIds.map((id) => [id, 0]));
for (const edge of edges) {
  if (!pending.has(edge.from) || !pending.has(edge.to)) continue;
  outs[edge.from].push(edge.to);
  incoming[edge.to] += 1;
}
const visited = new Set();
for (const start of pendingIds) {
  if (visited.has(start)) continue;
  const component = [];
  const stack = [start];
  while (stack.length) {
    const id = stack.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    component.push(id);
    for (const edge of edges) {
      if (edge.from === id && pending.has(edge.to)) stack.push(edge.to);
      if (edge.to === id && pending.has(edge.from)) stack.push(edge.from);
    }
  }
  const order = [];
  const used = new Set();
  const queue = component.filter((id) => incoming[id] === 0);
  if (!queue.length) queue.push(component[0]);
  while (queue.length) {
    const id = queue.shift();
    if (used.has(id)) continue;
    used.add(id);
    order.push(id);
    for (const to of outs[id] || []) if (component.includes(to)) queue.push(to);
  }
  for (const id of component) if (!used.has(id)) order.push(id);
  groups.push(order);
}
const columnOrder = ["命令", "文档", "原则", "剧本", "智能体", "自动化", "仓外", "根目录", "状态图案例"];
const usedKinds = [...new Set(nodes.map((node) => node.kind))];
usedKinds.sort((a, b) => columnOrder.indexOf(a) - columnOrder.indexOf(b));
const copy = {
  "文档": "技能附带的说明，入口之后再看。",
  "根目录": "仓库根上的文件，不是技能。",
  "自动化": "夜里在云端自己跑的流程。",
  "命令": "先读这一张，它是技能入口。",
  "剧本": "技能给出的例子。",
  "智能体": "被派出去干活的工人。",
  "仓外": "不在这个仓库里、仍会被用到的工具。",
  "原则": "技能要遵守的结构。",
  "状态图案例": "状态图技能用来对照的例子。"
};
const columns = usedKinds.map((id, index) => ({ id, blurb: copy[id] || "这一列的材料。", ...palette[index % palette.length] }));
const title = `${path.basename(source)} 卡片关系`;
for (const edge of edges) {
  if (!edge.from || !edge.to) continue;
  if (groups.some((group) => group.includes(edge.from) && group.includes(edge.to))) continue;
  groups.push([edge.from, edge.to]);
}
const groupModes = groups.map((group) => {
  if (group.length < 2) return "sequence";
  for (let i = 0; i < group.length - 1; i += 1) {
    const left = group[i];
    const right = group[i + 1];
    const linked = edges.some((edge) => (edge.from === left && edge.to === right) || (edge.from === right && edge.to === left));
    if (!linked) return "menu";
  }
  return "sequence";
});
const atlas = { title, columns, nodes, edges, groups, groupModes };
const slug = path.basename(source).toLowerCase().replace(/[^a-z0-9]+/g, "-");
const pageDir = path.join(root, "pages", slug);
fs.mkdirSync(pageDir, { recursive: true });
fs.writeFileSync(path.join(pageDir, "atlas-data.js"), "window.ATLAS = " + JSON.stringify(atlas) + ";\n");
fs.copyFileSync(path.join(root, "viewer", "index.html"), path.join(pageDir, "index.html"));
const page = path.join(pageDir, "index.html");
console.log(JSON.stringify({ page, nodes: nodes.length, edges: edges.length, groups: groups.length, columns: columns.map((column) => column.id) }, null, 2));
if (shouldOpen) execFileSync("open", [page], { stdio: "inherit" });
