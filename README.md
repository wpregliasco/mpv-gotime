# mpv-gotime

Open and seek videos with mpv, copy timestamp links for Obsidian.

## Features

- **`gotime` command**: Open a video at a specific timestamp, or seek if already open
- **Timestamp links**: Press `Ctrl+C` in mpv to copy a markdown link to clipboard
- **Multiple windows**: Each video gets its own IPC socket for independent control
- **Background mode**: New windows fork to background, command returns immediately

## Installation

```bash
# Clone the repository
git clone https://gitlab.com/your-username/mpv-gotime.git
cd mpv-gotime

# Install with uv
uv sync
```

## Usage

### Open or seek a video

```bash
# Open video at the beginning
gotime /path/to/video.mp4

# Open video at a specific time (seconds)
gotime /path/to/video.mp4 90

# Open video at a specific time (HH:MM:SS format)
gotime /path/to/video.mp4 01:30:00

# If video is already open, seeks to the time instead
gotime /path/to/video.mp4 00:05:30
```

### Copy timestamp links

While watching a video in mpv:

1. Press `Ctrl+C` at any point
2. A markdown link is copied to clipboard:
   ```
   [VideoName @ 00:01:30.500](file:///path/to/video.mp4#t=90.50)
   ```
3. Paste in Obsidian - clicking the link will open/seek the video

## Help

```bash
gotime --help
```

```
Usage: gotime [OPTIONS] FILE [TIME]

  Open or seek to a time in a video file. If already open, seeks to time.

Arguments:
  FILE   Path to the video file  [required]
  TIME   Time position (seconds or HH:MM:SS)  [default: 0]

Options:
  --help  Show this message and exit.
```

## Requirements

- Python 3.12+
- [mpv](https://mpv.io/) media player
- [python-mpv-jsonipc](https://pypi.org/project/python-mpv-jsonipc/)

## How it works

1. Each video file gets a deterministic IPC socket path (Base64-encoded filename)
2. `gotime` checks if the socket exists and mpv is responding
3. If open: sends seek command via IPC
4. If not open: forks to background, opens mpv with the socket, waits for window close

## Related

- **obsidian-gotime-plugin**: Obsidian plugin to handle timestamp link clicks - intercepts `file://...#t=` links and opens videos with gotime

## License

MIT
