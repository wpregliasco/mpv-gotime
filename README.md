# GoTime Video — Obsidian Plugin

Open video files at specific timestamps directly from your Obsidian notes using [mpv](https://mpv.io/).

Works on **Linux**, **Windows**, and **macOS**.

## Features

- Click `gotime://` links pointing to video files to open them in mpv
- **Portable paths**: Supports `gotime://~/relative/path` links that resolve via evidence profile — same notes work across machines
- Supports timestamp fragments (`#t=90.00`) to seek to a specific time
- Supports rectangle coordinates (`&rect=x,y,w,h`) for region selection
- **Wall-clock overlay**: When the linked video has an Evidence note tagged `evidence`+`lock` with a `sync_hora1` property, the plugin auto-injects `--h1` so mpv shows a running clock
- If the video is already open, seeks instead of opening a new window
- Automatically detects video files: `.mp4`, `.mov`, `.mkv`, `.avi`, `.webm`, `.flv`, `.wmv`, `.m4v`
- Opens at 0:00 if no timestamp is specified
- Configurable path to the `gotime` executable

## Prerequisites

1. **[mpv](https://mpv.io/)** media player installed
2. **[mpv-gotime](https://gitlab.com/obsidian_utils/gotime)** CLI tool installed
3. **Non-Flatpak Obsidian** (Linux only) — Flatpak sandboxing prevents launching GUI applications. Use the AppImage or native package instead.

## Installation

1. Clone this repository into your vault's plugin folder:
   ```bash
   cd /path/to/vault/.obsidian/plugins
   git clone https://github.com/wpregliasco/obsidian-gotime-plugin.git gotime-video
   ```

2. In Obsidian: **Settings → Community Plugins → Enable "GoTime Video"**

### Alternative: symlink

```bash
git clone https://github.com/wpregliasco/obsidian-gotime-plugin.git
ln -s "$(pwd)/obsidian-gotime-plugin" /path/to/vault/.obsidian/plugins/gotime-video
```

## Usage

Create timestamp links in your notes:

```markdown
# Absolute paths (work on the machine where they were created)
[Video @ 00:01:30](gotime:///home/user/Videos/video.mp4#t=90.00)
[My Clip](gotime:///home/user/Videos/clip.mov)

# Portable paths (work across machines with evidence profile configured)
[Video @ 00:01:30](gotime://~/video.mp4#t=90.00)
[My Clip @ 00:05:00](gotime://~/subdir/clip.mov#t=300.00&rect=100,200,50,50)
```

Click the link in reading mode to open the video in mpv.

### Opening videos from the terminal

```bash
# By file path
gotime /path/to/video.mp4 00:01:30

# By Evidence ID (requires mpvg shell function and fname utility)
mpvg G296
```

The `mpvg` helper resolves an Evidence ID to a file path via `fname` and opens it with `gotime`. Add this to your `~/.bashrc`:

```bash
mpvg() { gotime "$(fname "$1")"; }
```

### Generating links from mpv

The [mpv-gotime](https://gitlab.com/obsidian_utils/obsidian-gotime) CLI provides keyboard shortcuts while watching a video:

| Shortcut | Clipboard format |
|----------|------------------|
| `Ctrl+C` | `[HH:MM:SS](gotime://~/video.mp4#t=90.00)` |
| `Ctrl+T` | `HH:MM:SS` (plain text) |
| `Ctrl+F` | `[VideoName](gotime://~/video.mp4)` |
| `Ctrl+I` | `[G296](gotime://~/video.mp4)` — Evidence ID link |
| `Ctrl+L` | `[G296 @ HH:MM:SS](gotime://~/video.mp4#t=90.00)` — full with ID |
| `Ctrl+H` | `HH:MM:SS.sss` (plain text wall-clock; only when `--h1` is active) |
| `Ctrl+S` | Screenshot to clipboard (captures current frame with zoom, pan, rectangle) |
| `Ctrl+Shift+C/F/I/L` | Shareable `https://gotime-redirect.pages.dev/...` links (WhatsApp, Google Docs, Slack) |
| `Ctrl+Shift+S` | Screenshot to clipboard (same as Ctrl+S) |

When an evidence profile is configured, links use portable `gotime://~/` format. Otherwise, absolute paths are used.

Paste the copied link into your Obsidian note.

### Rectangle selection

Draw a rectangle overlay on the video to mark a region of interest. Coordinates are included in copied links (`&rect=x,y,w,h`).

1. **Pause** the video (`Space`)
2. Press **`b`** to activate the rectangle (defaults to 1/3 of video size, centered)
3. While active, arrow keys are temporarily rebound (hold for continuous movement):

| Key | Action |
|-----|--------|
| `←` / `→` / `↑` / `↓` | Move rectangle |
| `Shift+←` / `Shift+→` | Shrink / grow width |
| `Shift+↑` / `Shift+↓` | Shrink / grow height |
| `+` | Expand from center (preserves aspect ratio) |
| `-` | Contract from center (preserves aspect ratio) |
| `b` | Deactivate rectangle (restores arrow keys) |

4. Press any copy key (`Ctrl+C/T/F/I/L`) — link will include rectangle coordinates
5. The rectangle auto-deactivates on unpause or frame change (arrow keys restored)

## Wall-clock overlay (auto `--h1`)

If the video you click on has an Evidence note in the vault that satisfies all of the following, the plugin automatically appends `--h1 <sync_hora1>` to the `gotime` invocation:

1. The note's basename equals the video's Evidence ID (resolved via the `fid` CLI from [evidence-utils](https://gitlab.com/obsidian_utils/evidence)).
2. The note's frontmatter has both tags `evidence` **and** `lock` (matches `MDReader.istag` semantics: `tags` may be a string or a list).
3. The note's frontmatter contains a `sync_hora1` property in `HH:MM:SS[.sss]` format.

When all three conditions are met, mpv renders a running clock in the bottom-right corner that advances as `sync_hora1 + playback time`. While the clock is on screen, **`Ctrl+H`** copies the current wall-clock time as plain text.

Notes:

- The font is proportional to the video height (with a minimum size for low-res footage), so it stays readable across resolutions.
- The clock and the rectangle filter (`@rect`) are independent and can be used together.
- If `fid` is not on the plugin's `PATH`, lookup falls back to matching the video's filename stem against `<stem>.md` in the vault.
- The plugin keeps emitting helpful logs in the developer console (`Ctrl+Shift+I`): `GoTime click handler href: ...`, `GoTime fid → ...`, `GoTime executing: gotime [...]`.

## Settings

- **GoTime command path**: Path to the `gotime` executable. Default: `gotime`. Use a full path if it's not in your PATH.
- **Evidence base path**: Base directory for resolving portable `gotime://~/` links. Required for portable paths to work.

### Setting up portable paths

Portable paths allow the same Obsidian notes to work across different machines where video files live in different root directories.

1. Configure an evidence profile with `evidence-setup` — gotime reads the base path from `profiles.toml` automatically.
2. Set the same base path in the plugin: **Settings → GoTime Video → Evidence base path** (used for resolving links inside Obsidian).
3. Links using `gotime://~/relative/path` will resolve to the configured base path.

Each machine only needs its own local path configured — the links in your notes stay the same.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Related

- **[mpv-gotime](https://gitlab.com/obsidian_utils/gotime)** — The CLI tool that powers this plugin

## License

MIT
