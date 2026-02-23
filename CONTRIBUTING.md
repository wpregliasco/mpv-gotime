# Contributing to GoTime Video Plugin

Thanks for your interest in contributing! This plugin is currently **Linux-only** and we'd love help extending it to other platforms.

## Prerequisites

This plugin requires the [mpv-gotime CLI](https://gitlab.com/obsidian_utils/gotime) tool to be installed on the system. The CLI handles:
- Opening videos in mpv at specific timestamps
- Seeking in existing mpv windows via IPC sockets
- Copying timestamp markdown links to clipboard

## Areas Where Help Is Needed

### 🪟 Windows Support

The plugin currently spawns `gotime` via `bash` with Linux-specific environment variables. Key issues to solve for Windows:

1. **Shell spawning**: Replace `bash -c` with `cmd.exe /c` or `powershell` on Windows
2. **Environment variables**: `DISPLAY`, `XDG_RUNTIME_DIR` are Linux-only; Windows doesn't need them
3. **PATH handling**: `~/.local/bin` is a Linux convention; Windows uses `%APPDATA%` or `%LOCALAPPDATA%`
4. **File paths**: `file:///C:/path/to/video.mp4` format differs from Linux `file:///path/to/video.mp4`
5. **IPC sockets**: mpv uses named pipes on Windows instead of Unix sockets — the `mpv-gotime` CLI also needs Windows support

### 🍎 macOS Support

Similar to Linux but may need:
1. Different default PATH locations (e.g., `/usr/local/bin`, Homebrew paths)
2. Testing with macOS mpv installations

### General Improvements

- [ ] Auto-detect OS and adjust spawn behavior
- [ ] Configurable video file extensions in settings
- [ ] Support for custom mpv arguments
- [ ] Better error messages and troubleshooting notices

## Development Setup

```bash
git clone https://github.com/wpregliasco/obsidian-gotime-plugin.git
cd obsidian-gotime-plugin
npm install
npm run dev
```

Then symlink to your Obsidian vault:
```bash
# Linux/macOS
ln -s /path/to/obsidian-gotime-plugin /path/to/vault/.obsidian/plugins/gotime-video

# Windows (run as admin)
mklink /D "C:\path\to\vault\.obsidian\plugins\gotime-video" "C:\path\to\obsidian-gotime-plugin"
```

## Architecture

- `main.ts` — Plugin entry point. Registers a DOM click handler that intercepts `file://` links pointing to video files and spawns the `gotime` CLI.
- `manifest.json` — Plugin metadata for Obsidian.
- The plugin depends on the external `gotime` command from [mpv-gotime CLI](https://gitlab.com/obsidian_utils/gotime).

### How the click handler works

1. Intercepts clicks on `<a>` elements
2. Checks if the href points to a video file (by extension)
3. Parses the `#t=` fragment for the timestamp (defaults to 0)
4. Spawns `gotime <filepath> <time>` as a detached process

### Key file: `openWithGoTime()` in main.ts

This is the main function that needs platform-specific logic. Currently it:
- Uses `bash -c` to run the command
- Sets Linux-specific env vars (`DISPLAY`, `XDG_RUNTIME_DIR`)
- Hardcodes `~/.local/bin` in PATH

A cross-platform version should detect `process.platform` and adjust accordingly.

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/windows-support`)
3. Make your changes
4. Test on your platform
5. Submit a pull request with a description of what you changed and how to test it

## Questions?

Open an issue on GitHub or reach out to [@wpregliasco](https://github.com/wpregliasco).
