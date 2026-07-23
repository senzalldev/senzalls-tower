// nativeBridge — the web side of the native ⇄ JS contract used by the macOS
// shell (app/SenzallsTower/Bridge.swift). Installs `window.senzall` with
// Promise-based save/load/list plus a menu-action hook. In a plain browser
// (no native host) every call resolves to null so the game still runs.

type Pending = (value: unknown) => void;

interface WebkitBridge {
	messageHandlers: { senzall: { postMessage(message: unknown): void } };
}

export interface SoundConfig {
	ambience?: boolean;
	cash?: boolean;
	families?: Record<string, boolean>;
}

const pending = new Map<number, Pending>();
let seq = 0;
let menuHandler: (action: string) => void = () => {};
let soundHandler: ((config: SoundConfig) => void) | null = null;
let lastSoundConfig: SoundConfig | null = null;

function nativeHost(): WebkitBridge | null {
	const wk = (window as unknown as { webkit?: WebkitBridge }).webkit;
	return wk?.messageHandlers?.senzall ? wk : null;
}

function post(
	action: string,
	extra: Record<string, unknown> = {},
): Promise<unknown> {
	const host = nativeHost();
	if (!host) return Promise.resolve(null);
	const id = ++seq;
	return new Promise((resolve) => {
		pending.set(id, resolve);
		host.messageHandlers.senzall.postMessage({ id, action, ...extra });
	});
}

export const senzall = {
	/** True when running inside the native macOS shell. */
	isNative: (): boolean => nativeHost() !== null,
	/** Open the native About / details panel. */
	showAbout: () => post("showAbout"),
	/** Zoom the interface in/out by delta (native: pageZoom; browser: CSS zoom). */
	zoom: (delta: number) => {
		if (nativeHost()) {
			void post("zoom", { delta });
			return;
		}
		const el = document.documentElement as HTMLElement & {
			style: { zoom?: string };
		};
		const cur = Number.parseFloat(el.style.zoom || "1") || 1;
		el.style.zoom = String(Math.min(1.6, Math.max(0.8, cur + delta)));
	},
	save: (slot: string, state: string) => post("save", { slot, state }),
	autosave: (state: string) => post("autosave", { slot: "autosave", state }),
	load: (slot: string) => post("load", { slot }) as Promise<string | null>,
	list: () => post("list") as Promise<string[]>,
	/** Register the handler invoked when a native menu item fires. */
	onMenu: (handler: (action: string) => void) => {
		menuHandler = handler;
	},
	/** Register the Sound-menu config handler; replays the last config if any. */
	onSound: (handler: (config: SoundConfig) => void) => {
		soundHandler = handler;
		if (lastSoundConfig) handler(lastSoundConfig);
	},
	// ── Called from Swift via evaluateJavaScript ──
	_resolve: (id: number, payload: unknown) => {
		pending.get(id)?.(payload);
		pending.delete(id);
	},
	_menu: (action: string) => menuHandler(action),
	_sound: (config: SoundConfig) => {
		lastSoundConfig = config;
		soundHandler?.(config);
	},
};

export function installNativeBridge(): void {
	(window as unknown as { senzall: typeof senzall }).senzall = senzall;
}
