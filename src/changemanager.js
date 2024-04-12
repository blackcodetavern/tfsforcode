const Helper = require("./helper.js");

var changeManager = function (context) {
  let changedFiles = {}

  this.getStoredExcludedFiles = function () {
    var obj = context.globalState.get("excludedFiles");
    if (obj) return JSON.parse(obj);
    else return {}
  };

  this.setStoredExcludedFiles = function (excludedFiles) {
    excludedFiles = JSON.stringify(excludedFiles);
    context.globalState.update("excludedFiles", excludedFiles);
  };

  this.removeStoredExcludeFile = (fileName) => {
    var excludedFiles = this.getStoredExcludedFiles();
    delete excludedFiles[fileName]
    this.setStoredExcludedFiles(excludedFiles);
  };

  this.addStoredExcludeFile = (fileName) => {
    var excludedFiles = this.getStoredExcludedFiles();
    if (excludedFiles) {
      excludedFiles[fileName] = true;
      this.setStoredExcludedFiles(excludedFiles);
      
    }
  };


  

  this.rebuildTree = (included) => {
    var paths = Object.values(changedFiles)

    var usedPaths = [];
    var result = {};
    var arrayPaths = [];
    var excludedFiles = this.getStoredExcludedFiles();
    for (var i = 0; i < paths.length; i++) {
      var incTmp = true;
      if (excludedFiles[paths[i].path]) incTmp = false
      if (incTmp == included) {
        usedPaths.push(paths[i]);
        var reducedPath = paths[i].path.replace(Helper.getWorkspaceFolder(),"")
        arrayPaths.push(reducedPath.split("/"));
      }
    }
    
    for (var i = 0; i < arrayPaths.length; i++) {
      var pointer = result;
      for (var j = 0; j < arrayPaths[i].length; j++) {
        var current = arrayPaths[i][j];
        if (!pointer[current]) 
          pointer[current] = {
            label: current,
            children: {},
            mode: usedPaths[i].mode,
            included: included,
            fullPath: usedPaths[i].path,
          };
          pointer = pointer[current].children;
      }
    }
    
    return result;
  }

  this.addCheckedOutFile = (fileName) => {
    fileName = Helper.getWorkspaceFileName(fileName)
    this.addChangedFile(fileName, "C");
  };

  this.addNewFile = (fileName) => {
    fileName = Helper.getWorkspaceFileName(fileName)
    this.addChangedFile(fileName, "N");
  };

  this.addRenameFile = (fileNameOld, fileNameNew) => {
    fileNameOld = Helper.getWorkspaceFileName(fileNameNew)
    this.addChangedFile(fileNameNew, "R");
  };

  this.addDeletedFile = (fileName) => {
    fileName = Helper.getWorkspaceFileName(fileName)
    this.addChangedFile(fileName, "D");
  };

  this.addChangedFile = (fileName, mode) => {
    fileName = Helper.unifyFileName(fileName)
    fileName = Helper.getWorkspaceFileName(fileName)
    changedFiles[fileName] = {
      path: fileName,
      mode: mode
    }

  };

  this.includeFile = (fileName) => {
    this.removeStoredExcludeFile(fileName);
  }

  this.excludeFile = (fileName) => {
    this.addStoredExcludeFile(fileName);
  };

  this.removeChangedFile = (fileName) => {
    delete changedFiles[fileName]
    
  };


  this.setChangedFiles = (c) => {
    changedFiles = c;
  }

  this.getChangedFiles = () => {
    return changedFiles
  };

  this.getChangedFile = (fileName) => {
    return changedFiles[fileName] ? changedFiles[fileName] : {};
  }

  return this;
};

module.exports = changeManager;
