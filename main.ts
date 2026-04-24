import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { spawn } from 'child_process';
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
