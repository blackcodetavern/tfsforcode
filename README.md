# TFSForCode

TFSForCode is a Visual Studio Code extension that provides Team Foundation Server (TFS) operations in VS Code. The extension allows you to perform common source control operations directly from VS Code.

## Critical ToDos

There are some important shortcomings
- Works only with the german and english version of the tf.exe (you can change the settings)
- Renames, merges and undeletes are not yet possible
- No compare with previous version of a file
- No show history
- Include/Exclude all items from the pending changes treeview are missing.
- checkout of multiple files 
- ...

## Features

The extension contributes the following commands:

- TFS - Undo change: Undo the changes made to the file.
- TFS - Checkout file: Checkout the file from TFS.
- TFS - Add file: Add file to TFS.
These commands can be accessed from the context menu in the file explorer or the command palette (`Ctrl+Shift+P`).

The extension also provides a view container in the activity bar labelled "TFS", which includes two views, "Included Changes" and "Excluded Changes". These views display the files that are included and excluded from source control operations.

## Requirements

This extension requires the `tf.exe` command-line client for Team Foundation Server. You can specify the path to `tf.exe` in the extension settings (`tfsforcode.tfPath`).

## Dependencies

- iconv-lite: for character encoding conversion.
- ignore: for managing .gitignore style files.

## Disclaimer

Please note that this extension is provided "as is" and you use it at your own risk. The author is not responsible for any damages or loss of data that may occur from its use.
