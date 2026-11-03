// The merge of a newer server version into the editor: node --test test/merge.test.js
const test = require("node:test");
const assert = require("node:assert");
const { lines, mergeIntoEditor } = require("../src/merge.js");

/** The editor's text after the edits, applied from the back as VS Code does. */
function apply(text, edits) {
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  }
  return text;
}

test("lines keep their line ends", () => {
  assert.deepEqual(lines("a\r\nb\nc"), ["a\r\n", "b\n", "c"]);
  assert.deepEqual(lines(""), []);
});

test("the server changed something else: both changes stay", () => {
  const base = "one\r\ntwo\r\nthree\r\nfour\r\n";
  const latest = "one\r\ntwo\r\nthree (server)\r\nfour\r\n";
  const mine = "one (typed)\r\ntwo\r\nthree\r\nfour\r\n";
  const { conflict, edits } = mergeIntoEditor(base, latest, mine);
  assert.equal(conflict, false);
  assert.equal(apply(mine, edits), "one (typed)\r\ntwo\r\nthree (server)\r\nfour\r\n");
});

test("only the server's lines are touched - what the user typed is not replaced", () => {
  const base = "a\nb\nc\nd\ne\n";
  const latest = "a\nb\nc\nd\ne (server)\n";
  const mine = "a (typing here)\nb\nc\nd\ne\n";
  const { edits } = mergeIntoEditor(base, latest, mine);
  assert.equal(edits.length, 1);
  assert.ok(edits[0].start >= mine.indexOf("e\n"), "the edit lies below the user's line, the cursor keeps its place");
});

test("the server changed what the user changed: a conflict, nothing is touched", () => {
  const base = "a\nb\nc\n";
  const latest = "a\nb (server)\nc\n";
  const mine = "a\nb (typed)\nc\n";
  assert.deepEqual(mergeIntoEditor(base, latest, mine), { conflict: true, edits: [] });
});

test("no newer version: nothing to do", () => {
  const base = "a\nb\n";
  assert.deepEqual(mergeIntoEditor(base, base, "a\nb typed\n").edits, []);
});

test("lines added on the server and a last line without line end", () => {
  const base = "a\nb";
  const latest = "new first\na\nb";
  const mine = "a\nb, typed";
  const { conflict, edits } = mergeIntoEditor(base, latest, mine);
  assert.equal(conflict, false);
  assert.equal(apply(mine, edits), "new first\na\nb, typed");
});
