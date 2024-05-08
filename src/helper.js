const vscode = require("vscode");
const ignore = require("ignore");
const fs = require("fs");
const path = require("path");
const lang = require("./lang.js");
var configuration = vscode.workspace.getConfiguration("tfsforcode");

var ignoreParser;

function getTranslatedStrings() {
  return lang[configuration.get("tfLang")];
}

function getTFSPath() {
  return configuration.get("tfPath");
}

function getTFSBaseDir() {
  var baseDir = configuration.get("tfBaseDir");
  baseDir = baseDir.replace(/\\/g, "/").trim();
  if (baseDir.endsWith("/")) {
    baseDir = baseDir.slice(0, -1);
  }
  return baseDir.toLocaleLowerCase();
}

function convertToTFSPath(path) {
  var newPath = getTFSFileName(path);
  //newPath = newPath.replace(getTFSBaseDir(), "$");

  return newPath;
}

function getTFSCharSet() {
  return configuration.get("tfCharSet");
}

function getTFSContentCharSet() {
  return configuration.get("tfContentCharSet");
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
    console.log("Reading ignore files");
    ignoreParser = ignore
      .default()
      .add(gitignoreContent)
      .add(vscodeignoreContent);
  }
}

function getTFSFileName(fileName) {
  var baseDir = getWorkspaceFolderForTFS();
  if (baseDir) {
    fileName = fileName.split(getWorkspaceFolder()).join(baseDir);
  }
  return fileName;
}

function getWorkspaceFileName(fileName) {
  var baseDir = getWorkspaceFolder();
  if (baseDir) {
    fileName = fileName.replace(getWorkspaceFolderForTFS(), baseDir);
  }
  return fileName;
}

function isIgnoreFile(fileName) {
  if (!ignoreParser) {
    initIgnoreParser();
  }
  var baseDir = getTFSBaseDir();
  if (!baseDir) {
    console.log(
      "Ignore file: " + fileName.replace(getWorkspaceFolderForTFS(), "")
    );
    return true;
  }
  if (baseDir) {
    if (fileName + "/" == getWorkspaceFolder()) fileName += "/";
    fileName = fileName.replace(
      getWorkspaceFolder(),
      getWorkspaceFolderForTFS()
    );
    if (fileName == getWorkspaceFolderForTFS()) fileName += "test.txt";
    if (!fileName.startsWith(baseDir)) {
      console.log(
        "Ignore file: " + fileName.replace(getWorkspaceFolderForTFS(), "")
      );
      return true;
    }
  }

  fileName = fileName.replace(getWorkspaceFolderForTFS(), "");
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
}

function unifyFileName(fileName) {
  var fn = fileName.trim().replace(/\\/g, "/").toLocaleLowerCase();
  return fn;
}

async function revertFile(fileName) {
  console.log("Reverting" + fileName);
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
  return unifyFileName(
    workspaceFolders[0].uri.fsPath.toLocaleLowerCase() + "/"
  );
}

function getWorkspaceFolderForTFS() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return "";
  }
  var folderName = unifyFileName(
    workspaceFolders[0].uri.fsPath.toLocaleLowerCase() + "/"
  );
  var hardDrive = folderName.split(":")[0] + ":/";
  var hardDriveTFS = getTFSBaseDir().split(":")[0] + ":/";
  if (hardDrive.length == 3) {
    folderName = folderName.replace(hardDrive, hardDriveTFS);
  }
  return unifyFileName(folderName);
}

module.exports = {
  unifyFileName,
  revertFile,
  deleteFile,
  isIgnoreFile,
  isValidFile,
  getWorkspaceFolder,
  getWorkspaceFolderForTFS,
  getTranslatedStrings,
  getTFSPath,
  getTFSCharSet,
  getTFSFileName,
  getWorkspaceFileName,
  convertToTFSPath,
  getTFSContentCharSet,
};
