# GoTime Video — Obsidian Plugin

Open video files at specific timestamps directly from your Obsidian notes using [mpv](https://mpv.io/).

> ⚠️ **Currently Linux-only.** Contributions for Windows and macOS support are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## Features

- Click `file://` links pointing to video files to open them in mpv
- Supports timestamp fragments (`#t=90.00`) to seek to a specific time
- If the video is already open, seeks instead of opening a new window
- Automatically detects video files: `.mp4`, `.mov`, `.mkv`, `.avi`, `.webm`, `.flv`, `.wmv`, `.m4v`
- Opens at 0:00 if no timestamp is specified
- Configurable path to the `gotime` executable

## Prerequisites

1. **[mpv](https://mpv.io/)** media player installed
2. **[mpv-gotime]https://gitlab.com/obsidian_utils/gotime)** CLI tool installed:
   ```bash
   uv tool install /path/to/mpv_gotime
   ```
3. **Non-Flatpak Obsidian** — Flatpak sandboxing prevents launching GUI applications. Use the AppImage or native package instead.

## Installation

1. Clone this repository into your vault's plugin folder:
   ```bash
   cd /path/to/vault/.obsidian/plugins
   git clone https://github.com/wpregliasco/obsidian-gotime-plugin.git gotime-video
   cd gotime-video
   npm install
   npm run build
   ```

2. In Obsidian: **Settings → Community Plugins → Enable "GoTime Video"**

### Alternative: symlink

```bash
git clone https://github.com/wpregliasco/obsidian-gotime-plugin.git
cd obsidian-gotime-plugin
npm install && npm run build
ln -s "$(pwd)" /path/to/vault/.obsidian/plugins/gotime-video
```

## Usage

Create timestamp links in your notes:

```markdown
[Video @ 00:01:30](file:///home/user/Videos/video.mp4#t=90.00)
[My Clip](file:///home/user/Videos/clip.mov)
```

Click the link in reading mode to open the video in mpv.

### Generating links from mpv

The [mpv-gotime](https://gitlab.com/obsidian_utils/obsidian-gotime) CLI provides keyboard shortcuts while watching a video:

| Shortcut | Clipboard format |
|----------|-----------------|
| `Ctrl+C` | `[HH:MM:SS](file:///path/to/video.mp4#t=90.00)` |
| `Ctrl+T` | `HH:MM:SS` (plain text) |
| `Ctrl+F` | `[VideoName](file:///path/to/video.mp4)` |
| `Ctrl+L` | `[VideoName @ HH:MM:SS](file:///path/to/video.mp4#t=90.00)` |

Paste the copied link into your Obsidian note.

## Settings

- **GoTime command path**: Path to the `gotime` executable. Default: `gotime`. Use a full path if it's not in your PATH.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — help with **Windows** and **macOS** support is especially welcome!

## Related

- **[mpv-gotime](https://gitlab.com/obsidian_utils/gotime)** — The CLI tool that powers this plugin

## License

MIT
