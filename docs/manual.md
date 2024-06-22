# Manual

## Post-installation instructions

Requires [chrome-shell] for running shell commands.

[chrome-shell]: https://github.com/taupiqueur/chrome-shell

### Allow native messaging with the shell application

Copy the extension ID and run the following in your terminal.

```
chrome-shell install [--target=<platform>] [<extension-id>...]
```

Possible targets are `chrome`, `chrome-dev`, `chrome-beta`, `chrome-canary` and `chromium`.

## Usage

`Ctrl+I` is the main keyboard shortcut.

Use it to edit text areas in webpages with nano.

### Configure keyboard shortcuts

Navigate to `chrome://extensions/shortcuts` to configure keyboard shortcuts.

### Configure the text editor program

You can also configure the text editor program by importing and exporting settings
in the “Options” page—Right-click the nano toolbar button and select “Options”.

Example configuration:

``` json
{
  "nano": {
    "command": "xterm",
    "args": ["-e", "nano", "--"]
  }
}
```

``` json
{
  "nano": {
    "command": "open",
    "args": ["-n", "-W", "--"]
  }
}
```

Make sure the commands are in your `PATH`.

On macOS, you can set the `PATH` environment variable for all services through [launchctl].

``` sh
sudo launchctl config user path "$PATH"
```

[launchctl]: https://ss64.com/osx/launchctl.html
