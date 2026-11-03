// The ignore files the way tf.exe reads its .tfignore: every .tfignore from
// the TFS base directory down to a file's folder counts, each for its own
// folder and everything below it; a deeper one decides over a higher one.
// Until 0.13 only .gitignore and .vscodeignore of the workspace root were
// read, so a ui\.tfignore with node_modules in it was never seen, and npm
// install sent thousands of files to "tf add".
//
// No vscode in here: the rules can be tested with plain node (test/tfignore.test.js).

const fs = require("fs");
const path = require("path");
const ignore = require("ignore");

// file -> { mtimeMs, matcher }: read again only when the file changed
const known = new Map();

/** A .tfignore line in the syntax of the ignore package (gitignore). Same
 *  meaning, different spelling: a leading "\" anchors to the .tfignore's
 *  folder ("/" in gitignore), "\" separates folders, "!" includes again. */
function toGitignore(line) {
  let rule = line.trim();
  if (!rule || rule.startsWith("#")) return "";
  const include = rule.startsWith("!");
  if (include) rule = rule.slice(1).trim();
  return (include ? "!" : "") + rule.replace(/\\/g, "/");
}

/** The rules of one ignore file, or null if there is none. tfignore: the
 *  file is in .tfignore syntax; otherwise gitignore. */
function rulesOf(file, tfignore = true) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch (e) {
    known.delete(file);
    return null;
  }
  const hit = known.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit.matcher;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const matcher = ignore().add(tfignore ? lines.map(toGitignore).filter(Boolean) : lines);
  known.set(file, { mtimeMs: stat.mtimeMs, matcher });
  return matcher;
}

/** Whether a .tfignore between root and file leaves file out. */
function isTfIgnored(file, root) {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return false;
  const parts = relative.split(path.sep);
  let ignored = false;
  for (let depth = 0; depth < parts.length; depth++) {
    const rules = rulesOf(path.join(root, ...parts.slice(0, depth), ".tfignore"));
    if (!rules) continue;
    const verdict = rules.test(parts.slice(depth).join("/"));
    if (verdict.ignored) ignored = true;
    else if (verdict.unignored) ignored = false;
  }
  return ignored;
}

/** Whether one of the folders a file lies in is named in never (setting
 *  tfsforcode.neverAdd) - node_modules, also where no .tfignore says so. */
function isInNeverAdded(file, root, never) {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  const folders = relative.split(path.sep).slice(0, -1).map((f) => f.toLowerCase());
  const named = never.map((n) => n.toLowerCase());
  return folders.some((f) => named.includes(f)) || named.includes(path.basename(file).toLowerCase());
}

module.exports = { toGitignore, rulesOf, isTfIgnored, isInNeverAdded };
