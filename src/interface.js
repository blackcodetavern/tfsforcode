const vscode = require('vscode');
const util = require('util');
const fs = require('fs')
const exec = util.promisify(require('child_process').exec);

let configuration = vscode.workspace.getConfiguration("tfsforcode");
const tfPath = configuration.get("tfPath");

const helper = require("./helper")




var TFSInterface = (function () {

  this.checkoutFile = async function (fileName) {
    if (helper.isIgnoreFile(fileName)) return false;
    if (!helper.isValidFile(tfPath)) return false;
    fileName = helper.unifyFileName(fileName);
    console.log(`TFS-Interface, checkout, ${fileName}`);
    try {
      await exec(`"${tfPath}" checkout ${fileName}`);
      return true;
    } catch (e) {
      return false;
    }
  }

  this.checkinFiles = async function (fileNames, comment) {
    if (fileNames.length == 0) {
      vscode.window.showWarningMessage("No files to check in.");
      console.log(`TFS-Interface, checkin, no files for check-in`);
      return;
    }
    console.log(`TFS-Interface, checkin`);
    try {
      // Stellen Sie sicher, dass der Kommentar korrekt mit Anführungszeichen umschlossen ist
      comment = `"${comment}"`;

      // Dateinamen für das Kommando formatieren
      let formattedFileNames = fileNames
        .filter((x) => !helper.isIgnoreFile(helper.unifyFileName(x)))
        .map((name) => {
          return `"${name}"`;
        })
        .join(" ");
      
      if (formattedFileNames && formattedFileNames.length > 0) {
        console.log(
          `"${tfPath}" checkin /comment:${comment} ${formattedFileNames}`
        );
        await exec(
          `"${tfPath}" checkin /comment:${comment} ${formattedFileNames}`
        );
        vscode.window.showInformationMessage("Files successfully checked-in.");
        return true;
      }
    } catch (e) {
      vscode.window.showErrorMessage("Error during check-in.");
      return false;
    }
  }

  this.deleteFile = async function(fileName) {
    if (helper.isIgnoreFile(fileName)) return false;
    if (!helper.isValidFile(tfPath)) return false;
    fileName = helper.unifyFileName(fileName);
    console.log(`TFS-Interface, delete, ${fileName}`);
    try {
      await exec(`"${tfPath}" delete ${fileName}`);
      return true;
    } catch (e) {
      return false;
    }
  }

  this.addFile = async function(fileName) {
    if (helper.isIgnoreFile(fileName)) return false;
    if (!helper.isValidFile(tfPath)) return false;
    fileName = helper.unifyFileName(fileName);
    console.log(`TFS-Interface, add, ${fileName}`);
    try {
      await exec(`"${tfPath}" add ${fileName}`);
      return true;
    } catch (e) {
      return false;
    }
  }

  this.undoCheckout = async function (fileName) {
    if (helper.isIgnoreFile(fileName)) return false;
    if (!helper.isValidFile(tfPath)) return false;
    fileName = helper.unifyFileName(fileName);
    console.log(`TFS-Interface, undo, ${fileName}`);
    try {
      await exec(`"${tfPath}" undo ${fileName}`);
      return true;
    } catch (e) {
      return false;
    }
  }

  this.getCheckedOutFiles = async function () {
    let checkedOutFiles = {};
    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    if (!workspaceFolder) {
      return;
    }
    const workingDirectory = workspaceFolder.uri.fsPath.toLocaleLowerCase();

    console.log(`TFS-Interface, status`);
    try {
      var result = await exec(`"${tfPath}" status /recursive`, {
        cwd: workingDirectory,
        encoding: "latin1", // TODO: User can choose between utf-8 and latin1
      });
    } catch (e) {
      return checkedOutFiles;
    }

    const lines = result.stdout.split("\n");
    for (const line of lines) {
      if (!(line.toLocaleLowerCase().indexOf(workingDirectory) > -1)) continue;
      var elements = line.split(" ");
      var fileName = helper.unifyFileName(elements[elements.length - 1]);
      // TODO: Language dependend strings for status
      if (line.indexOf("bearbeiten") > -1) {
        checkedOutFiles[fileName] = { path: fileName, mode: "C" };
      } else if (line.indexOf("hinzufügen") > -1) {
        checkedOutFiles[fileName] = { path: fileName, mode: "N" };
      } else if (line.indexOf("löschen") > -1) {
        checkedOutFiles[fileName] = { path: fileName, mode: "D" };
      }
    }
    return checkedOutFiles;
  };

  return this;
})

module.exports = TFSInterface()