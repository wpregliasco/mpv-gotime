var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => GoTimePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_child_process = require("child_process");
var DEFAULT_SETTINGS = {
  gotimePath: "gotime",
  evidencePaths: ""
};
var GoTimePlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerDomEvent(document, "click", (evt) => {
      const target = evt.target;
      const link = target.closest("a");
      if (!link)
        return;
      const href = link.getAttribute("href") || link.getAttribute("data-href");
      if (!href)
        return;
      console.log("GoTime click handler href:", href);
      if (href.startsWith("file://")) {
        const url = new URL(href);
        const filePath = decodeURIComponent(url.pathname);
        const videoExtensions = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".flv", ".wmv", ".m4v"];
        if (videoExtensions.some((ext) => filePath.toLowerCase().endsWith(ext))) {
          evt.preventDefault();
          evt.stopPropagation();
          const finalHref = href.includes("#t=") ? href : `${href}#t=0`;
          this.openWithGoTime(finalHref);
          return;
        }
      }
      if (!href.startsWith("http")) {
        const fullHref = href.startsWith("file://") ? href : `file://${href}`;
        const url = new URL(fullHref);
        const filePath = decodeURIComponent(url.pathname);
        const videoExtensions = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".flv", ".wmv", ".m4v"];
        if (videoExtensions.some((ext) => filePath.toLowerCase().endsWith(ext))) {
          evt.preventDefault();
          evt.stopPropagation();
          const finalHref = href.includes("#t=") ? fullHref : `${fullHref}#t=0`;
          this.openWithGoTime(finalHref);
        }
      }
    }, true);
    this.addSettingTab(new GoTimeSettingTab(this.app, this));
    console.log("GoTime plugin loaded");
  }
  onunload() {
    console.log("GoTime plugin unloaded");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  openWithGoTime(href) {
    var _a;
    let filePath;
    let fragment;
    if (href.startsWith("file:///~/") || href.startsWith("file://~/")) {
      const raw = href.startsWith("file:///~/") ? href.slice("file://".length) : "/" + href.slice("file://".length);
      const hashIdx = raw.indexOf("#");
      if (hashIdx >= 0) {
        filePath = decodeURIComponent(raw.slice(0, hashIdx));
        fragment = raw.slice(hashIdx + 1);
      } else {
        filePath = decodeURIComponent(raw);
        fragment = "";
      }
    } else {
      const url = new URL(href);
      filePath = decodeURIComponent(url.pathname);
      fragment = url.hash.slice(1);
    }
    const params = new URLSearchParams(fragment);
    const timeStr = (_a = params.get("t")) != null ? _a : "0";
    const rect = params.get("rect");
    let cmd = `${this.settings.gotimePath} "${filePath}" ${timeStr}`;
    if (rect)
      cmd += ` --rect ${rect}`;
    console.log("GoTime executing:", cmd);
    const child = (0, import_child_process.spawn)("bash", ["-c", cmd], {
      env: {
        ...process.env,
        PATH: `/home/willy/.local/bin:${process.env.PATH}`,
        DISPLAY: process.env.DISPLAY || ":0",
        XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || "/run/user/1000",
        HOME: process.env.HOME,
        USER: process.env.USER,
        EVIDENCE_PATHS: this.settings.evidencePaths || process.env.EVIDENCE_PATHS || ""
      },
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    child.on("error", (error) => {
      new import_obsidian.Notice(`GoTime error: ${error.message}`);
      console.error("GoTime error:", error);
    });
    child.on("spawn", () => {
      console.log("GoTime spawned successfully");
      new import_obsidian.Notice("\u{1F3AC} Opening video...");
    });
  }
};
var GoTimeSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("GoTime command path").setDesc("Path to the gotime executable (use full path if not in PATH)").addText((text) => text.setPlaceholder("gotime").setValue(this.plugin.settings.gotimePath).onChange(async (value) => {
      this.plugin.settings.gotimePath = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Evidence base path").setDesc("Base path for portable video links (file://~/...). Set to your local video root directory.").addText((text) => text.setPlaceholder("/home/user/Videos").setValue(this.plugin.settings.evidencePaths).onChange(async (value) => {
      this.plugin.settings.evidencePaths = value;
      await this.plugin.saveSettings();
    }));
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
