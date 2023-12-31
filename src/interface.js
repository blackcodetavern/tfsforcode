const vscode = require('vscode');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const Helper = require("./helper")




var TFSInterface = (function () {
  var checkFile = function (fileName) {
    if (!fileName) return false;
    if (!(fileName.indexOf(Helper.getWorkspaceFolder()) > -1)) return false; // File is not inside of the workingdir
    fileName = Helper.unifyFileName(fileName);
    if (Helper.isIgnoreFile(fileName)) return false; // File is excluded by the .gitignore or .vscodeignore
    return true;
  }


  this.execute = async (command, params) => {
    let tfPath = Helper.getTFSPath();
    if (!Helper.isValidFile(tfPath)) return { success: false, result: "TF.exe is invalid" };
    try {
      console.log(`Try execute: "${tfPath}" ${command} ${params}`);
      var result = await exec(`"${tfPath}" ${command} ${params}`, {
        cwd: Helper.getWorkspaceFolder(),
        encoding: Helper.getTFSCharSet(),
      });
      console.log(`Execution successful: "${tfPath}" ${command} ${params}`);
      return {successful:true, msg: result.stdout+""};
    } catch (e) {
      vscode.window.showErrorMessage(`Error during ${command}.`);
      return { successful: false, msg: result.stderr+"" };
    }
  }

  


  this.deleteFile = async (fileName) => {
    if (!checkFile(fileName)) return false;
    return (await this.execute("delete",`"${fileName}"`)).successful
  };

  this.addFile = async (fileName) => {
    if (!checkFile(fileName)) return false;
    return (await this.execute("delete", `"${fileName}"`)).successful;
  };

  this.undoCheckout = async (fileName) => {
     if (!checkFile(fileName)) return false;
     return (await this.execute("undo", `"${fileName}"`)).successful;
  };


  this.checkoutFile = async (fileName) => {
       if (!checkFile(fileName)) return false;
       return (await this.execute("checkout", `"${fileName}"`)).successful;
    };

  this.checkinFiles = async (fileNames, comment) => {
    if (fileNames.length == 0) {
      vscode.window.showWarningMessage("No files to check in.");
      return false;
    }

    comment = `"${comment}"`;
    let formattedFileNames = fileNames
      .filter((x) => !checkFile(x))
      .map((name) => {
        return `"${name}"`;
      })
      .join(" ");

    return await this.execute(
      "checkin",
      `/comment:${comment} ${formattedFileNames}`
    );
  }

  this.getCheckedOutFiles = async () => {
    var translatedStrings = Helper.getTranslatedStrings();
    let checkedOutFiles = {};
    let result = await this.execute("status", "/recursive");

    const lines = result.msg.split("\n");
    for (const line of lines) {
      var elements = line.split(" ");
      var fileName = Helper.unifyFileName(elements[elements.length - 1]);
      if (!checkFile(fileName)) continue;
      if (line.indexOf(translatedStrings.edit) > -1) {
        checkedOutFiles[fileName] = { path: fileName, mode: "C" };
      } else if (line.indexOf(translatedStrings.add) > -1) {
        checkedOutFiles[fileName] = { path: fileName, mode: "N" };
      } else if (line.indexOf(translatedStrings.delete) > -1) {
        checkedOutFiles[fileName] = { path: fileName, mode: "D" };
      } else if (line.indexOf(translatedStrings.rename) > -1) {
        checkedOutFiles[fileName] = { path: fileName, mode: "R" };
      }
    }
    return checkedOutFiles;
  };

  return this;
})

module.exports = TFSInterface()