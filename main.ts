import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { spawn } from 'child_process';

interface GoTimeSettings {
	gotimePath: string;
}

const DEFAULT_SETTINGS: GoTimeSettings = {
	gotimePath: 'gotime'
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

			// Check if it's a file:// link (with or without time fragment)
			if (href.startsWith('file://')) {
				const url = new URL(href);
				const filePath = decodeURIComponent(url.pathname);
				const videoExtensions = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.flv', '.wmv', '.m4v'];
				
				// Only intercept video files
				if (videoExtensions.some(ext => filePath.toLowerCase().endsWith(ext))) {
					evt.preventDefault();
					evt.stopPropagation();
					
					// If no #t= fragment, add #t=0
					const finalHref = href.includes('#t=') ? href : `${href}#t=0`;
					this.openWithGoTime(finalHref);
					return;
				}
			}

			// Also check for links that might be relative paths
			if (!href.startsWith('http')) {
				const fullHref = href.startsWith('file://') ? href : `file://${href}`;
				const url = new URL(fullHref);
				const filePath = decodeURIComponent(url.pathname);
				const videoExtensions = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.flv', '.wmv', '.m4v'];
				
				// Only intercept video files
				if (videoExtensions.some(ext => filePath.toLowerCase().endsWith(ext))) {
					evt.preventDefault();
					evt.stopPropagation();
					
					// If no #t= fragment, add #t=0
					const finalHref = href.includes('#t=') ? fullHref : `${fullHref}#t=0`;
					this.openWithGoTime(finalHref);
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

	openWithGoTime(href: string) {
		// Parse file:///path/to/video.mp4#t=90.00
		const url = new URL(href);
		const filePath = decodeURIComponent(url.pathname);
		const timeFragment = url.hash.replace('#t=', '');
		
		const cmd = `${this.settings.gotimePath} "${filePath}" ${timeFragment}`;
		console.log('GoTime executing:', cmd);
		
		const child = spawn('bash', ['-c', cmd], {
			env: { 
				...process.env, 
				PATH: `/home/willy/.local/bin:${process.env.PATH}`,
				DISPLAY: process.env.DISPLAY || ':0',
				XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/run/user/1000',
				HOME: process.env.HOME,
				USER: process.env.USER
			},
			detached: true,
			stdio: 'ignore'
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
	}
}
