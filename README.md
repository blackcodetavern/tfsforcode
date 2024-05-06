# TFSForCode

TFSForCode is a Visual Studio Code extension that provides Team Foundation Server (TFS) operations in VS Code. The extension allows you to perform common source control operations directly from VS Code.

## Build VSIX

First install the requirements: npm install
To build the extension just write: vsce package

## Critical ToDos

There are some important shortcomings

- Works only with the german and english version of the tf.exe (you can change the settings)
- Merges and undeletes are not yet possible
- No show history
- Include/Exclude all items from the pending changes treeview are missing.
- checkout of multiple files

## Features

The extension contributes the following commands:

- TFS - Undo change: Undo the changes made to the file.
- TFS - Checkout file: Get Latest Version of the File and checkout of the file from TFS.
- TFS - Add file: Add file to TFS.
- TFS - Get Latest Version
- TFS - Compare with latest Version
- TFS - Rename
  These commands can be accessed from the context menu in the file explorer or the command palette (`Ctrl+Shift+P`).

The extension also provides a view container in the activity bar labelled "TFS", which includes two views, "Included Changes" and "Excluded Changes". These views display the files that are included and excluded from source control operations.

## Requirements

- This extension requires the `tf.exe` command-line client for Team Foundation Server. You can specify the path to `tf.exe` in the extension settings (`tfsforcode.tfPath`).
- Your Project needs to be a Visual Studio Code Workspace. (File > Save as Workspace, than open Workspace (e.g. over recent files))
- Use a .gitignore or .vscodeignore file to exclude files, which should not be added to the TFS. E.g. if you don't have one and
  execute "npm install" it will add all npm packages as new files for the TFS, which is not useful.

## Dependencies

- iconv-lite: for character encoding conversion.
- ignore: for managing .gitignore style files.

## Disclaimer

Please note that this extension is provided "as is" and you use it at your own risk. The author is not responsible for any damages or loss of data that may occur from its use.
