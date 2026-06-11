import { App, Plugin, PluginSettingTab, Setting, Notice, TFile } from 'obsidian';
import { spawn, spawnSync } from 'child_process';
import * as path from 'path';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

interface GoTimeSettings {
	gotimePath: string;
	evidencePaths: string;
}

const DEFAULT_SETTINGS: GoTimeSettings = {
	gotimePath: 'gotime',
	evidencePaths: ''
};

export default class GoTimePlugin extends Plugin {
	settings: GoTimeSettings;

	async onload() {
		await this.loadSettings();

		// Register click handler for all links
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			const target = evt.target as HTMLElement;
			const link = target.closest('a') as HTMLAnchorElement;
			
			if (!link) return;
			
			const href = link.getAttribute('href') || link.getAttribute('data-href');
			if (!href) return;
			console.log('GoTime click handler href:', href);

			// Handle gotime:// links (intercept here so we can add --h1 etc.)
			// Format: gotime://path?t=N&rect=x,y,w,h  (query, not fragment).
			// We convert to file://path#t=N&rect=... so openWithGoTime parses it.
			if (href.startsWith('gotime://')) {
				evt.preventDefault();
				evt.stopPropagation();
				const rest = href.slice('gotime://'.length);
				const qIdx = rest.indexOf('?');
				const pathPart = qIdx >= 0 ? rest.slice(0, qIdx) : rest;
				const query = qIdx >= 0 ? rest.slice(qIdx + 1) : '';
				const fileHref = query ? `file://${pathPart}#${query}` : `file://${pathPart}`;
				this.openWithGoTime(fileHref);
				return;
			}

			// Check if it's a file:// link
			if (href.startsWith('file://')) {
				const resolved = this.resolveFilePath(href);
				const videoExtensions = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.flv', '.wmv', '.m4v', '.vob', '.ts', '.mts', '.mpg', '.mpeg'];
				
				evt.preventDefault();
				evt.stopPropagation();

				if (videoExtensions.some(ext => resolved.toLowerCase().endsWith(ext))) {
					// Video: open with gotime/mpv
					const finalHref = href.includes('#t=') ? href : `${href}#t=0`;
					this.openWithGoTime(finalHref);
				} else {
					// Non-video: open with OS default handler
					this.openWithDefault(resolved);
				}
				return;
			}

			// Also check for links that might be relative file paths
			// Skip internal Obsidian links (no extension or .md) to let Obsidian handle them
			if (!href.startsWith('http') && !href.startsWith('#')) {
				const dotIdx = href.lastIndexOf('.');
				const ext = dotIdx >= 0 ? href.slice(dotIdx).toLowerCase() : '';
				// Only intercept if it has a non-.md file extension (i.e. a real file)
				if (ext && ext !== '.md') {
					const fullHref = `file://${href}`;
					const resolved = this.resolveFilePath(fullHref);
					const videoExtensions = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.flv', '.wmv', '.m4v', '.vob', '.ts', '.mts', '.mpg', '.mpeg'];
					
					evt.preventDefault();
					evt.stopPropagation();

					if (videoExtensions.some(ext => resolved.toLowerCase().endsWith(ext))) {
						const finalHref = href.includes('#t=') ? fullHref : `${fullHref}#t=0`;
						this.openWithGoTime(finalHref);
					} else {
						this.openWithDefault(resolved);
					}
				}
			}
		}, true);

		// Add settings tab
		this.addSettingTab(new GoTimeSettingTab(this.app, this));

		console.log('GoTime plugin loaded');
	}

	onunload() {
		console.log('GoTime plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	resolveFilePath(href: string): string {
		// Resolve portable /~/ paths to absolute using evidencePaths setting
		if (href.startsWith('file:///~/') || href.startsWith('file://~/')) {
			const raw = href.startsWith('file:///~/')
				? href.slice('file:///~/'.length)
				: href.slice('file://~/'.length);
			const hashIdx = raw.indexOf('#');
			const relPath = decodeURIComponent(hashIdx >= 0 ? raw.slice(0, hashIdx) : raw);
			const basePath = (this.settings.evidencePaths || '').replace(/[\/]+$/, '');
			return path.join(basePath, relPath);
		}
		const url = new URL(href);
		let pathname = decodeURIComponent(url.pathname);
		// On Windows, file:///D:/path gives pathname /D:/path — strip leading /
		if (isWin && /^\/[A-Za-z]:/.test(pathname)) {
			pathname = pathname.slice(1);
		}
		return pathname;
	}

	openWithDefault(filePath: string) {
		console.log('GoTime opening with default handler:', filePath);
		let child;
		if (isWin) {
			child = spawn('cmd', ['/c', 'start', '', filePath], {
				detached: true,
				stdio: 'ignore'
			});
		} else if (isMac) {
			child = spawn('open', [filePath], {
				detached: true,
				stdio: 'ignore'
			});
		} else {
			child = spawn('xdg-open', [filePath], {
				detached: true,
				stdio: 'ignore'
			});
		}
		child.unref();
		child.on('error', (error) => {
			new Notice(`GoTime error: ${error.message}`);
			console.error('GoTime open error:', error);
		});
	}

	// ----- Wall-clock overlay (h1) lookup -----
	// Mirrors the semantics of MDReader.istag in obsidian-sync:
	// - frontmatter.tags may be undefined, a string, or a string[]
	// - returns true only if ALL required tags are present.
	istag(frontmatter: any, required: string[]): boolean {
		const raw = frontmatter?.tags;
		let tags: string[];
		if (typeof raw === 'string') {
			tags = [raw];
		} else if (Array.isArray(raw)) {
			tags = raw.map(String);
		} else {
			tags = [];
		}
		return required.every(t => tags.includes(t));
	}

	// Transform a video path into something `fid` can consume.
	// For portable links (/~/relative/path) we strip the /~/ prefix and pass
	// the relative path; `fid` will resolve it using the active evidence
	// profile (so it works even if the plugin's evidencePaths setting is
	// stale or points to an unmounted drive). Absolute paths are passed
	// through unchanged.
	pathForFid(filePath: string): string {
		if (filePath.startsWith('/~/')) {
			return filePath.slice(3); // "/~/VIDEOS/..." → "VIDEOS/..."
		}
		return filePath;
	}

	// Call the `fid` CLI to resolve a video path to its Evidence ID (e.g. "V096").
	// Returns null if `fid` is not installed, errors, or finds no match.
	resolveFid(videoPath: string): string | null {
		const abs = this.pathForFid(videoPath);
		try {
			const homeDir = process.env.HOME || process.env.USERPROFILE || '';
			const uvBin = path.join(homeDir, '.local', 'bin');
			const pathSep = isWin ? ';' : ':';
			const envPATH = `${uvBin}${pathSep}${process.env.PATH ?? ''}`;
			const env = { ...process.env, PATH: envPATH } as NodeJS.ProcessEnv;
			const res = spawnSync('fid', [abs], { env, encoding: 'utf8', timeout: 3000 });
			if (res.status === 0) {
				const id = (res.stdout || '').trim();
				if (id) return id;
			}
		} catch (e) {
			console.error('GoTime fid error:', e);
		}
		return null;
	}

	findEvidenceNote(videoPath: string): TFile | null {
		const mdFiles = this.app.vault.getMarkdownFiles();
		// 1) Resolve the Evidence ID via the `fid` CLI and look up <id>.md.
		const id = this.resolveFid(videoPath);
		if (id) {
			const byId = mdFiles.find(f => f.basename === id);
			if (byId) return byId;
		}
		// 2) Fallback: match by the video file's stem (legacy convention).
		const base = path.basename(videoPath);
		const stem = base.replace(/\.[^.]+$/, '');
		return mdFiles.find(f => f.basename === stem) ?? null;
	}

	// Parse a frontmatter time value (number of seconds, or an HH:MM:SS[.sss]
	// string, or plain seconds as a string) into seconds. Mirrors the
	// hms_to_secs logic used across the gotime/obsidian-sync toolchain.
	hmsToSecs(val: any): number | null {
		if (val == null) return null;
		if (typeof val === 'number') return val;
		const s = String(val).trim();
		if (!s) return null;
		let sign = 1;
		let body = s;
		if (body.startsWith('-')) { sign = -1; body = body.slice(1); }
		let out = 0;
		for (const part of body.split(':')) {
			const n = parseFloat(part);
			if (Number.isNaN(n)) return null;
			out = out * 60 + n;
		}
		return sign * out;
	}

	// Collect clip overlay segments from a clipped evidence note's frontmatter.
	// Each clip_<n>_in/out defines a media sub-range; clip_<n>_hora1 (present
	// only for synced clips) provides the wall-clock start. Returns null when
	// the note has no clip_* properties.
	collectClips(fm: any): string | null {
		const numbers = new Set<number>();
		for (const key of Object.keys(fm)) {
			const m = /^clip_(\d+)_in$/.exec(key);
			if (m) numbers.add(parseInt(m[1], 10));
		}
		if (numbers.size === 0) return null;
		const chunks: string[] = [];
		for (const n of Array.from(numbers).sort((a, b) => a - b)) {
			const tin = this.hmsToSecs(fm[`clip_${n}_in`]);
			const tout = this.hmsToSecs(fm[`clip_${n}_out`]);
			if (tin == null || tout == null) continue;
			const h1 = this.hmsToSecs(fm[`clip_${n}_hora1`]);
			chunks.push(`${n},${tin},${tout},${h1 != null ? h1 : ''}`);
		}
		return chunks.length ? chunks.join(';') : null;
	}

	// Build the overlay CLI args for a video. Clipped files (any clip_*
	// property) get a per-clip --clips overlay; whole-file uniform files
	// (evidence+lock with sync_hora1) get a single --h1 clock.
	getOverlayArgs(videoPath: string): string[] {
		console.log('GoTime overlay lookup for:', videoPath);
		const file = this.findEvidenceNote(videoPath);
		console.log('GoTime evidence note →', file?.path ?? null);
		if (!file) return [];
		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
		console.log('GoTime frontmatter →', fm);
		if (!fm) return [];
		// Only act on actual evidence notes.
		if (!this.istag(fm, ['evidence'])) {
			console.log('GoTime not an evidence note → no overlay');
			return [];
		}
		// Clip-aware overlay takes precedence over a single whole-file clock.
		const clips = this.collectClips(fm);
		if (clips) {
			console.log('GoTime clips →', clips);
			return ['--clips', clips];
		}
		// Whole-file uniform wall-clock (legacy --h1 path).
		if (this.istag(fm, ['lock']) && fm.sync_hora1 != null) {
			console.log('GoTime sync_hora1 →', fm.sync_hora1);
			return ['--h1', String(fm.sync_hora1)];
		}
		return [];
	}

	openWithGoTime(href: string) {
		// Parse file:///path/to/video.mp4#t=90.00&rect=x,y,w,h
		// or portable: file://~/relative/path.mp4#t=90.00&rect=x,y,w,h
		let filePath: string;
		let fragment: string;

		if (href.startsWith('file:///~/') || href.startsWith('file://~/')) {
			// Portable path: URL parser mangles ~ as hostname, extract manually
			// Normalize to /~/path regardless of whether file:///~/ or file://~/
			const raw = href.startsWith('file:///~/') 
				? href.slice('file://'.length)   // file:///~/... → /~/...
				: '/' + href.slice('file://'.length); // file://~/... → /~/...
			const hashIdx = raw.indexOf('#');
			if (hashIdx >= 0) {
				filePath = decodeURIComponent(raw.slice(0, hashIdx));
				fragment = raw.slice(hashIdx + 1);
			} else {
				filePath = decodeURIComponent(raw);
				fragment = '';
			}
		} else {
			const url = new URL(href);
			filePath = decodeURIComponent(url.pathname);
			// On Windows, file:///D:/path gives pathname /D:/path — strip leading /
			if (isWin && /^\/[A-Za-z]:/.test(filePath)) {
				filePath = filePath.slice(1);
			}
			fragment = url.hash.slice(1); // remove leading '#'
		}

		const params = new URLSearchParams(fragment);
		const timeStr = params.get('t') ?? '0';
		const rect = params.get('rect');

		const args = [filePath, timeStr];
		if (rect) args.push('--rect', rect);
		args.push(...this.getOverlayArgs(filePath));
		console.log('GoTime executing:', this.settings.gotimePath, args);

		// Build platform-aware PATH with uv tool bin directory
		const homeDir = process.env.HOME || process.env.USERPROFILE || '';
		const uvBin = path.join(homeDir, '.local', 'bin');
		const pathSep = isWin ? ';' : ':';
		const envPATH = `${uvBin}${pathSep}${process.env.PATH}`;

		// Build environment — include X11 vars only on Linux
		const env: Record<string, string> = {
			...process.env as Record<string, string>,
			PATH: envPATH
		};
		if (!isWin) {
			env.DISPLAY = process.env.DISPLAY || ':0';
			env.XDG_RUNTIME_DIR = process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid?.() ?? 1000}`;
		}

		const child = spawn(this.settings.gotimePath, args, {
			env,
			detached: true,
			stdio: 'ignore',
			shell: isWin
		});
		
		child.unref();
		
		child.on('error', (error) => {
			new Notice(`GoTime error: ${error.message}`);
			console.error('GoTime error:', error);
		});
		
		child.on('spawn', () => {
			console.log('GoTime spawned successfully');
			new Notice('🎬 Opening video...');
		});
	}
}

class GoTimeSettingTab extends PluginSettingTab {
	plugin: GoTimePlugin;

	constructor(app: App, plugin: GoTimePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('GoTime command path')
			.setDesc('Path to the gotime executable (use full path if not in PATH)')
			.addText(text => text
				.setPlaceholder('gotime')
				.setValue(this.plugin.settings.gotimePath)
				.onChange(async (value) => {
					this.plugin.settings.gotimePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Evidence base path')
			.setDesc('Base path for portable video links (file://~/...). Set to your local video root directory.')
			.addText(text => text
				.setPlaceholder(isWin ? 'D:\\Videos' : '/home/user/Videos')
				.setValue(this.plugin.settings.evidencePaths)
				.onChange(async (value) => {
					this.plugin.settings.evidencePaths = value;
					await this.plugin.saveSettings();
				}));
	}
}
