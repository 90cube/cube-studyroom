// Build-time notebook preprocessor.
// Reads .ipynb files from the cloned course repo, extracts an ordered list of
// slim cells, writes embedded base64 images out as separate asset files, and
// emits one slim JSON per notebook plus an index. No Python / Jupyter needed.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Walk up from the project to find the sibling course clone, so this works
// whether the app sits at Analysis/diffusion-study or Analysis/cube-studyroom/diffusion.
function findCourseRepo(start) {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    const cand = path.join(dir, "Diffusion_Gen_AI_Course");
    if (fs.existsSync(cand)) return cand;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(start, "..", "..", "Diffusion_Gen_AI_Course");
}

const COURSE_REPO = process.env.COURSE_REPO || findCourseRepo(PROJECT_ROOT);
const OUT_DATA = path.resolve(PROJECT_ROOT, "public", "notebooks");
const OUT_ASSETS = path.resolve(PROJECT_ROOT, "public", "nb-assets");

const joinSource = (s) => (Array.isArray(s) ? s.join("") : s || "");
const stripAnsi = (s) => s.replace(/\[[0-9;]*m/g, "");

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function findNotebooks(root) {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...findNotebooks(full));
    else if (entry.name.endsWith(".ipynb")) out.push(full);
  }
  return out;
}

// part_2_1_diffusion_from_scratch_pytorch -> "diffusion from scratch pytorch"
function deriveTitle(fileBase) {
  return fileBase
    .replace(/^part_\d+(_\d+)?_/i, "")
    .replace(/_/g, " ")
    .trim();
}

function partKeyFromDir(dir) {
  const m = dir.match(/^part_(\d+)/i);
  return m ? Number(m[1]) : 999;
}

function writeImage(notebookId, b64, mime) {
  const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
  const data = Buffer.from((b64 || "").replace(/\s/g, ""), "base64");
  const hash = crypto.createHash("sha1").update(data).digest("hex").slice(0, 12);
  const dir = path.join(OUT_ASSETS, notebookId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${hash}.${ext}`), data);
  return `/nb-assets/${notebookId}/${hash}.${ext}`;
}

function normalizeOutput(notebookId, out) {
  const type = out.output_type;
  if (type === "stream") {
    return { kind: "stream", name: out.name || "stdout", text: joinSource(out.text) };
  }
  if (type === "error") {
    return {
      kind: "error",
      ename: out.ename || "",
      evalue: out.evalue || "",
      traceback: stripAnsi((out.traceback || []).join("\n")),
    };
  }
  if (type === "execute_result" || type === "display_data") {
    const data = out.data || {};
    if (data["image/png"]) {
      return { kind: "image", src: writeImage(notebookId, data["image/png"], "image/png") };
    }
    if (data["image/jpeg"]) {
      return { kind: "image", src: writeImage(notebookId, data["image/jpeg"], "image/jpeg") };
    }
    if (data["text/html"]) {
      return { kind: "html", html: joinSource(data["text/html"]) };
    }
    if (data["text/plain"]) {
      return { kind: "text", text: joinSource(data["text/plain"]) };
    }
  }
  return null;
}

// Rewrite markdown attachment refs (![alt](attachment:name)) to asset files.
function extractMarkdownAttachments(notebookId, cell, source) {
  const att = cell.attachments;
  if (!att) return source;
  let result = source;
  for (const [name, mimeMap] of Object.entries(att)) {
    const mime = Object.keys(mimeMap)[0];
    if (!mime) continue;
    const src = writeImage(notebookId, mimeMap[mime], mime);
    result = result.split(`attachment:${name}`).join(src);
  }
  return result;
}

function processNotebook(file) {
  const rel = path.relative(COURSE_REPO, file).replace(/\\/g, "/");
  const dir = rel.split("/")[0];
  const fileBase = path.basename(file, ".ipynb");
  const id = `${dir}__${fileBase}`.replace(/[^a-zA-Z0-9_]/g, "_");

  const nb = JSON.parse(fs.readFileSync(file, "utf8"));
  const cells = [];
  let codeCount = 0;
  let mdCount = 0;

  for (const cell of nb.cells || []) {
    if (cell.cell_type === "markdown") {
      mdCount++;
      const source = extractMarkdownAttachments(id, cell, joinSource(cell.source));
      cells.push({ type: "markdown", source });
    } else if (cell.cell_type === "code") {
      codeCount++;
      const outputs = (cell.outputs || [])
        .map((o) => normalizeOutput(id, o))
        .filter(Boolean);
      cells.push({ type: "code", source: joinSource(cell.source), outputs });
    }
  }

  const slim = { id, part: partKeyFromDir(dir), dir, file: path.basename(file), title: deriveTitle(fileBase), cells };
  fs.writeFileSync(path.join(OUT_DATA, `${id}.json`), JSON.stringify(slim));

  return { id, part: slim.part, dir, file: slim.file, title: slim.title, cellCount: cells.length, codeCount, mdCount };
}

function main() {
  const force = process.argv.includes("--force");
  const indexPath = path.join(OUT_DATA, "index.json");
  if (!force && fs.existsSync(indexPath)) {
    console.log("Notebooks already built (use --force to rebuild).");
    return;
  }
  if (!fs.existsSync(COURSE_REPO)) {
    console.error(`Course repo not found at ${COURSE_REPO}`);
    console.error("Clone it next to this app: git clone https://github.com/mohan696matlab/Diffusion_Gen_AI_Course.git");
    process.exit(1);
  }
  resetDir(OUT_DATA);
  resetDir(OUT_ASSETS);

  const files = findNotebooks(COURSE_REPO).sort();
  const index = files.map(processNotebook).sort((a, b) =>
    a.part - b.part || a.file.localeCompare(b.file)
  );

  fs.writeFileSync(path.join(OUT_DATA, "index.json"), JSON.stringify(index, null, 2));
  console.log(`Processed ${index.length} notebooks -> public/notebooks/`);
  for (const n of index) console.log(`  [${n.part}] ${n.id}  (${n.cellCount} cells)`);
}

main();
