// The .tfignore rules without VS Code: node --test test/tfignore.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { isTfIgnored, isInNeverAdded, toGitignore } = require("../src/tfignore.js");

function workspace(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tfignore-"));
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return root;
}

test("a .tfignore line reads as gitignore", () => {
  assert.equal(toGitignore("\\bin"), "/bin");
  assert.equal(toGitignore("! keep\\this.dll"), "!keep/this.dll");
  assert.equal(toGitignore("# comment"), "");
  assert.equal(toGitignore("   "), "");
});

test("the .tfignore of a subfolder counts for what lies below it", () => {
  // AIModuleTester: ui\.tfignore names node_modules, the root .env and results.
  const root = workspace({
    "project/.tfignore": "# passwords\r\n.env\r\nresults\r\n__pycache__\r\n",
    "project/ui/.tfignore": "node_modules\r\ndist\r\n.quasar\r\n",
  });
  const ignored = (file) => isTfIgnored(path.join(root, file), root);
  assert.ok(ignored("project/ui/node_modules/vue/index.js"));
  assert.ok(ignored("project/ui/node_modules"));
  assert.ok(ignored("project/ui/dist/spa/index.html"));
  assert.ok(ignored("project/.env"));
  assert.ok(ignored("project/blocks/__pycache__/x.pyc"));
  assert.ok(!ignored("project/ui/src/App.vue"));
  assert.ok(!ignored("project/.env.template"));
  // ui\.tfignore does not reach up: a node_modules beside ui is not covered by it
  assert.ok(!ignored("project/node_modules/x.js"));
});

test("case does not matter, as in TFS", () => {
  const root = workspace({ ".tfignore": "Node_Modules\r\n" });
  assert.ok(isTfIgnored(path.join(root, "UI", "node_modules", "a.js"), root));
});

test("a leading backslash means this folder only, ! takes a file back", () => {
  const root = workspace({ ".tfignore": "\\bin\r\n*.dll\r\n!keep.dll\r\n" });
  const ignored = (file) => isTfIgnored(path.join(root, file), root);
  assert.ok(ignored("bin/a.txt"));
  assert.ok(!ignored("src/bin/a.txt"));
  assert.ok(ignored("src/x.dll"));
  assert.ok(!ignored("src/keep.dll"));
});

test("a deeper .tfignore decides over a higher one", () => {
  const root = workspace({ ".tfignore": "*.log\r\n", "logs/.tfignore": "!important.log\r\n" });
  assert.ok(isTfIgnored(path.join(root, "a.log"), root));
  assert.ok(!isTfIgnored(path.join(root, "logs", "important.log"), root));
});

test("a changed .tfignore counts at once", () => {
  const root = workspace({ ".tfignore": "a.txt\r\n" });
  assert.ok(isTfIgnored(path.join(root, "a.txt"), root));
  fs.writeFileSync(path.join(root, ".tfignore"), "b.txt\r\n");
  fs.utimesSync(path.join(root, ".tfignore"), new Date(), new Date(Date.now() + 5000));
  assert.ok(!isTfIgnored(path.join(root, "a.txt"), root));
});

test("node_modules is never added, also without a .tfignore", () => {
  const root = workspace({});
  assert.ok(isInNeverAdded(path.join(root, "ui", "node_modules", "vue", "index.js"), root, ["node_modules"]));
  assert.ok(isInNeverAdded(path.join(root, "ui", "Node_Modules"), root, ["node_modules"]));
  assert.ok(!isInNeverAdded(path.join(root, "ui", "src", "modules.js"), root, ["node_modules"]));
});
