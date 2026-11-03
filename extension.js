const fs = require("fs");
const iconv = require("iconv-lite");
const vscode = require("vscode");
const tfDoneEmitter = new vscode.EventEmitter();
var cm = require("./src/changemanager.js");

const TFSInterface = require("./src/interface.js");
const Helper = require("./src/helper.js");
const { mergeIntoEditor } = require("./src/merge.js");

var lockWatcher = false;
// Files whose checkout runs right now - the first change of a checked-in
// file starts it, and the changes typed meanwhile must not start it again.
const checkingOut = new Set();

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  var ChangeManager = cm(context);

  async function refreshCheckedOutFiles() {
    var folder = Helper.getWorkspaceFolderForTFS();
    if (Helper.isIgnoreFile(folder)) return;
    ChangeManager.setChangedFiles(await TFSInterface.getCheckedOutFiles());
    tfDoneEmitter.fire();
  }

  async function undoChanges(fileName) {
    if (Helper.isIgnoreFile(fileName)) return;
    let changedFile = ChangeManager.getChangedFile(fileName);
    await TFSInterface.undoCheckout(fileName);
    if (changedFile.mode == "C") await Helper.revertFile(fileName);
    else if (changedFile.mode == "N") await Helper.deleteFile(fileName);
    ChangeManager.removeChangedFile(fileName);
    tfDoneEmitter.fire();
  }

  function readFileOrNull(fileName) {
    try {
      return fs.readFileSync(fileName);
    } catch (e) {
      return null;
    }
  }

  /** Gets the latest version and checks the file out. document: the editor
   *  the user is typing in. Nothing of what they type is reset any more:
   *  the version on disk is read before and after "tf get", and only if the
   *  server had a newer one are its changes merged in - where they belong,
   *  so the cursor stays. Before, the whole text was replaced twice, and
   *  what was typed during the seconds tf.exe took was lost. */
  async function checkoutFile(fileName, document) {
    if (Helper.isIgnoreFile(fileName)) return false;
    let changedFile = ChangeManager.getChangedFile(fileName);
    if (changedFile.path || checkingOut.has(fileName)) return false;

    checkingOut.add(fileName);
    lockWatcher = true; // tf get rewrites the file: no reaction of the file watcher to it
    var success = false;
    try {
      const before = readFileOrNull(fileName);
      await TFSInterface.getLatestVersion(fileName);
      const after = readFileOrNull(fileName);
      success = await TFSInterface.checkoutFile(fileName);
      if (document && before && after && !before.equals(after))
        await bringInServerChanges(fileName, document, before, after);
    } finally {
      lockWatcher = false;
      checkingOut.delete(fileName);
    }

    if (success) {
      ChangeManager.addCheckedOutFile(fileName);
      tfDoneEmitter.fire();
    }

    return success;
  }

  async function bringInServerChanges(fileName, document, before, after) {
    const charset = Helper.getTFSContentCharSet();
    const text = (buffer) => iconv.decode(buffer, charset).replace(/^﻿/, "");
    const { conflict, edits } = mergeIntoEditor(text(before), text(after), document.getText());
    if (conflict) {
      const choice = await vscode.window.showWarningMessage(
        "There is a newer version on the server, and it changes lines you are editing. " +
          "Your text is unchanged; on disk is the server's version.",
        "Compare"
      );
      if (choice == "Compare") compare(fileName, document.uri.fsPath);
      return;
    }
    if (edits.length == 0) return;
    const edit = new vscode.WorkspaceEdit();
    for (const e of edits) {
      edit.replace(document.uri, new vscode.Range(document.positionAt(e.start), document.positionAt(e.end)), e.text);
    }
    await vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage("A newer version from the server was merged into your changes.");
  }

  async function addFile(fileName) {
    if (Helper.isIgnoreFile(fileName)) return;
    let changedFile = ChangeManager.getChangedFile(fileName);
    if (changedFile.mode == "R") return;
    var success = await TFSInterface.addFile(fileName);
    if (success) {
      ChangeManager.addNewFile(fileName);
    } else {
      ChangeManager.removeChangedFile(fileName);
    }
    tfDoneEmitter.fire();
  }

  async function getLatestVersion(fileName) {
    if (Helper.isIgnoreFile(fileName)) return;
    lockWatcher = true;
    var success = await TFSInterface.getLatestVersion(fileName);
    lockWatcher = false;
    tfDoneEmitter.fire();
  }

  async function compare(fileName, fileNameOriginal) {
    if (Helper.isIgnoreFile(fileName)) return;
    var fileContent = (await TFSInterface.view(fileName)).msg;
    const contentWithoutBOM = fileContent.replace("ï»¿", "");
    const serverDocument = await vscode.workspace.openTextDocument({
      content: contentWithoutBOM,
      language: "plaintext",
    });

    // Diff-Ansicht öffnen
    vscode.commands.executeCommand(
      "vscode.diff",
      serverDocument.uri,
      vscode.Uri.file(fileNameOriginal),
      "Server ↔ Lokale Datei"
    );
    tfDoneEmitter.fire();
  }

  async function renameFile(fileNameOld, fileNameNew) {
    if (Helper.isIgnoreFile(fileNameOld)) return;
    if (Helper.isIgnoreFile(fileNameNew)) return;
    var success = TFSInterface.renameFile(fileNameOld, fileNameNew);
    if (success) {
      ChangeManager.addRenameFile(fileNameOld, fileNameNew);
    }
    tfDoneEmitter.fire();
  }

  async function deleteFile(fileName) {
    if (Helper.isIgnoreFile(fileName)) return;
    let changedFile = ChangeManager.getChangedFile(fileName);
    if (changedFile.mode == "C") await TFSInterface.undoCheckout(fileName);

    if (await TFSInterface.deleteFile(fileName)) {
      ChangeManager.addDeletedFile(fileName);
      tfDoneEmitter.fire();
    }
  }

  async function checkInFiles(fileNames, comment) {
    await TFSInterface.checkinFiles(fileNames, comment);

    for (var i = 0; i < fileNames.length; i++) {
      if (!Helper.isIgnoreFile(fileNames[i]))
        ChangeManager.removeChangedFile(fileNames[i]);
    }
    tfDoneEmitter.fire();
  }

  function getLeaves(item, out) {
    if (item.children) {
      var children = Object.values(item.children);
      if (children.length == 0) out.push(item);
    } else {
      children = Object.values(item);
    }
    for (var i = 0; i < children.length; i++) {
      var curChild = children[i];
      var curChildLength = Object.values(children[i].children).length;
      if (curChildLength == 0) {
        out.push(curChild);
      } else {
        getLeaves(curChild, out);
      }
    }
  }

  async function changeIncludation(item, include) {
    var leaves = [];
    getLeaves(item, leaves);
    for (var i = 0; i < leaves.length; i++) {
      var fileName = leaves[i].fullPath;
      if (Helper.isIgnoreFile(fileName)) continue;
      if (include) ChangeManager.includeFile(fileName);
      else ChangeManager.excludeFile(fileName);
      tfDoneEmitter.fire([vscode.Uri.file(fileName)]);
    }
    tfDoneEmitter.fire();
  }

  // Undo action
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsforcode.undo", async (uri) => {
      var fileName = Helper.unifyFileName(uri.fsPath);
      const confirm = await vscode.window.showWarningMessage(
        "Do you want to undo all changes on the file " + fileName + "?",
        { modal: true },
        "Yes",
        "No"
      );
      if (confirm == "Yes") {
        undoChanges(fileName);
      }
    })
  );

  // Checkout action
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsforcode.checkout", async (uri) => {
      var fileName = Helper.unifyFileName(uri.fsPath);
      checkoutFile(fileName);
    })
  );

  // Compare action
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsforcode.compare", async (uri) => {
      var fileName = Helper.unifyFileName(uri.fsPath);
      compare(fileName, uri.fsPath);
    })
  );

  // Add action
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsforcode.add", async (uri) => {
      var fileName = Helper.unifyFileName(uri.fsPath);
      addFile(fileName);
    })
  );

  // Get latest version action
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsforcode.getlatest", async (uri) => {
      var fileName = Helper.unifyFileName(uri.fsPath);
      getLatestVersion(fileName);
    })
  );

  // Rename action
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsforcode.rename", async (uri) => {
      let fileNameNew = await vscode.window.showInputBox({
        prompt: "What is the new name of the file?",
      });
      var fileName = Helper.unifyFileName(uri.fsPath);
      //add full path of old file to new file
      fileNameNew =
        fileName.split("/").slice(0, -1).join("/") + "/" + fileNameNew;
      fileNameNew = Helper.unifyFileName(fileNameNew);
      renameFile(fileName, fileNameNew);
    })
  );

  // Exclude action
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsforcode.exclude", async (item) => {
      changeIncludation(item, false);
    })
  );

  // Include action
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsforcode.include", async (item) => {
      changeIncludation(item, true);
    })
  );

  // Checkout action
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.document.isDirty && event.contentChanges.length > 0) {
        var fileName = Helper.unifyFileName(event.document.fileName);
        checkoutFile(fileName, event.document);
      }
    })
  );

  let watcher = vscode.workspace.createFileSystemWatcher("**/*");

  watcher.onDidCreate((uri) => {
    if (lockWatcher) return;
    let fileName = Helper.unifyFileName(uri.fsPath);

    addFile(fileName);
  });

  watcher.onDidChange(() => {
    if (lockWatcher) return;
    refreshCheckedOutFiles();
  });

  watcher.onDidDelete((uri) => {
    if (lockWatcher) return;
    let fileName = Helper.unifyFileName(uri.fsPath);

    var file = ChangeManager.getChangedFile(fileName);
    if (!file.path || file.mode == "C") deleteFile(fileName);
    if (file.mode == "N") undoChanges(fileName);
    //else undoChanges(fileName)
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("tfsforcode.checkin", async () => {
      await vscode.workspace.saveAll();
      var fileNames = [];
      getLeaves(ChangeManager.rebuildTree(true), fileNames);
      let message = await vscode.window.showInputBox({
        prompt: "Enter a check-in comment",
      });
      if (message !== undefined) {
        checkInFiles(
          fileNames.map((x) => x.fullPath),
          message
        );
      }
    })
  );

  let decorationProvider = {
    onDidChangeFileDecorations: tfDoneEmitter.event,
    provideFileDecoration: (uri) => {
      let fileName = Helper.unifyFileName(uri.fsPath);
      fileName = Helper.getWorkspaceFileName(fileName);
      let changedFile = ChangeManager.getChangedFile(fileName);
      if (changedFile.mode == "C") {
        return {
          badge: "C",
          tooltip: "Checked out file",
          propagate: false,
        };
      } else if (changedFile.mode == "N") {
        return {
          badge: "N",
          tooltip: "New file",
          propagate: false,
        };
      } else if (changedFile.mode == "D") {
        return {
          badge: "C",
          tooltip: "Deleted file",
          propagate: false,
        };
      } else if (changedFile.mode == "R") {
        return {
          badge: "R",
          tooltip: "Renamed file",
          propagate: false,
        };
      }
    },
  };

  let disposable =
    vscode.window.registerFileDecorationProvider(decorationProvider);
  context.subscriptions.push(disposable);

  let treeDataProvider = (included) => {
    return {
      onDidChangeTreeData: tfDoneEmitter.event,
      getChildren: (node) => {
        let tree = ChangeManager.rebuildTree(included);
        if (!node) return Object.values(tree);
        var childrenLength = Object.values(node.children).length;
        if (childrenLength == 0) {
          return node;
        } else {
          return Object.values(node.children);
        }
      },
      getTreeItem: (node) => {
        var childrenLength = Object.values(node.children).length;
        let info = "";
        if (childrenLength > 0) info = "";
        else if (node.mode == "C") info = " [edit]";
        else if (node.mode == "N") info = " [add]";
        else if (node.mode == "D") info = " [delete]";

        return {
          label: node.label + info,
          collapsibleState: childrenLength
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None,
          contextValue: "file",
        };
      },
    };
  };
  let tPIncluded = treeDataProvider(true);
  let tPExcluded = treeDataProvider(false);
  vscode.window.createTreeView("checkedOutFilesIncluded", {
    treeDataProvider: tPIncluded,
  });

  vscode.window.createTreeView("checkedOutFilesExcluded", {
    treeDataProvider: tPExcluded,
  });

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "checkedOutFilesIncluded",
      tPIncluded
    )
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "checkedOutFilesExcluded",
      tPExcluded
    )
  );

  refreshCheckedOutFiles();
}
// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
