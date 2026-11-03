# Change Log

All notable changes to the "tfsforcode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.14.0]
- Editing a checked-in file no longer throws away what you type: the latest version is still fetched and the file checked out, but your text stays. Only if the server had a newer version are its changes merged in, where they belong, so the cursor does not jump. If they touch lines you are editing, your text is left alone and you are offered a comparison.

## [0.13.0]
- New files are checked against the `.tfignore` files, as tf.exe reads them: every one from the base dir down to the file's folder, not only the workspace root. Before, a `ui\.tfignore` with `node_modules` in it was never read, and `npm install` added its packages to the TFS.
- New setting `tfsforcode.neverAdd` (default `node_modules`): folders that are never added, also where no ignore file names them.
- Ignore files are read again when they change; before, only once per VS Code session.

## [0.7.0]
- Add base dir for TFS. Please specify this value in the settings of the project.