const vscode = require('vscode');
const ignore = require("ignore");
const fs = require("fs");
const path = require("path")
const lang = require("./lang.js");
var configuration = vscode.workspace.getConfiguration("tfsforcode");

var ignoreParser;

function getTranslatedStrings() {
  return lang[configuration.get("tfLang")]
}

function getTFSPath() {
  return configuration.get("tfPath");
}

function getTFSCharSet() {
  return configuration.get("tfCharSet");
}


function initIgnoreParser() {
    const gitignorePath = path.join(getWorkspaceFolder(), ".gitignore");
    const vscodeignorePath = path.join(getWorkspaceFolder(), ".vscodeignore");

    let gitignoreContent = "";
    let vscodeignoreContent = "";

    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath).toString();
    }

    if (fs.existsSync(vscodeignorePath)) {
      vscodeignoreContent = fs.readFileSync(vscodeignorePath).toString();
    }

  if (!ignoreParser) {
      console.log("Reading ignore files")
      ignoreParser = ignore
        .default()
        .add(gitignoreContent)
        .add(vscodeignoreContent);
    }  
}

function isIgnoreFile(fileName) {
  if (!ignoreParser) {
    initIgnoreParser()
  }
    
  
  fileName = fileName.replace(getWorkspaceFolder(), "");
  var pathSegments = fileName.split("/");
  pathSegments.pop();
  
  if (pathSegments.some((segment) => segment.startsWith("."))) {
    console.log("Ignore file: " + fileName);
    return true;
  }

  var result = ignoreParser.ignores(fileName);
  if (result == true) console.log("Ignore file: " + fileName);
  else console.log("Allow: " + fileName);
  return result;
};

function unifyFileName(fileName) {
  return fileName.trim().replace(/\\/g, '/').toLocaleLowerCase()
}

async function revertFile(fileName) {
  console.log("Reverting" + fileName)
  if (isIgnoreFile(fileName)) return;
  let document = await vscode.workspace.openTextDocument(
    vscode.Uri.file(fileName)
  );
  await vscode.window.showTextDocument(document);
  await vscode.commands.executeCommand("workbench.action.files.revert");
}

async function deleteFile(fileName) {
  if (isIgnoreFile(fileName)) return;
  let uri = vscode.Uri.file(fileName);
  try {
    await vscode.workspace.fs.stat(uri);
  } catch (e) {
    console.log(
      `File ${fileName} does not exist anymore and will not be deleted.`
    );
    return;
  }
  try {
    await vscode.workspace.fs.delete(uri, { useTrash: true });
  } catch (e) {
    console.error(`Error deleting ${fileName}.`);
  }
}

function isValidFile(fileName) {
    if (fs.existsSync(fileName)) {
      return true;
    }
    return false;
}

function getWorkspaceFolder() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return "";
  }
  return unifyFileName(workspaceFolders[0].uri.fsPath.toLocaleLowerCase() + "/");
}


module.exports = {
  unifyFileName,
  revertFile,
  deleteFile,
  isIgnoreFile,
  isValidFile,
  getWorkspaceFolder,
  getTranslatedStrings,
  getTFSPath,
  getTFSCharSet
};