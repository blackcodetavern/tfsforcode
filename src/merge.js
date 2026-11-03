// Bringing a newer server version into what the user typed meanwhile: a
// three-way merge of the file as it was when typing began (base), the version
// "tf get" brought (latest) and the editor's text (mine). The result comes as
// edits on mine, each where it belongs, so the editor applies them without the
// cursor jumping - replacing the whole text moved it, and lost the keystrokes
// of the seconds tf.exe took.
//
// No vscode in here: tested with plain node (test/merge.test.js).

const { diff3Merge, diffPatch } = require("node-diff3");

/** The lines of a text with their line ends: joined they give the text back. */
function lines(text) {
  return text.match(/[^\n]*\n|[^\n]+$/g) || [];
}

/** { conflict, edits }: edits are { start, end, text } as character offsets
 *  in mine. conflict: the server changed lines the user changed as well -
 *  then nothing is changed, and the user decides. */
function mergeIntoEditor(base, latest, mine) {
  const regions = diff3Merge(lines(mine), lines(base), lines(latest));
  if (regions.some((region) => region.conflict)) return { conflict: true, edits: [] };
  const merged = regions.flatMap((region) => region.ok);

  const mineLines = lines(mine);
  const starts = [0];
  for (const line of mineLines) starts.push(starts[starts.length - 1] + line.length);
  const edits = diffPatch(mineLines, merged).map((patch) => ({
    start: starts[patch.buffer1.offset],
    end: starts[patch.buffer1.offset + patch.buffer1.length],
    text: patch.buffer2.chunk.join(""),
  }));
  return { conflict: false, edits };
}

module.exports = { lines, mergeIntoEditor };
