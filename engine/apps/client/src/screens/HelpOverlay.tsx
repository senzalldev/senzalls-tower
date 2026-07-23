import { memo, useEffect, useState } from "react";

// In-app wiki / help. Original guidance written from this game's actual
// mechanics — not reproduced from any SimTower manual.

interface Section {
	id: string;
	title: string;
	body: HelpBlock[];
}

type HelpBlock =
	| { kind: "p"; text: string }
	| { kind: "h"; text: string }
	| { kind: "ul"; items: string[] }
	| { kind: "changelog" };

// App version injected by the native shell (window.__SENZALL_VERSION).
const APP_VERSION =
	typeof window !== "undefined"
		? ((window as unknown as { __SENZALL_VERSION?: string })
				.__SENZALL_VERSION ?? "")
		: "";

interface ChangeEntry {
	version: string;
	notes: string[];
}

// Newest first. Bump this with each release.
const CHANGELOG: ChangeEntry[] = [
	{
		version: "1.0.16",
		notes: [
			"Emergency prompts (bomb/fire) now pause the clock until you answer.",
		],
	},
	{
		version: "1.0.15",
		notes: ["Sound menu: added Mute All Sounds (alongside Enable All)."],
	},
	{
		version: "1.0.14",
		notes: [
			"Reorganized the top bar into three groups: controls · money · clock.",
		],
	},
	{
		version: "1.0.13",
		notes: ["Cleaner title bar: single title, version shown as a subtitle."],
	},
	{
		version: "1.0.12",
		notes: ["The window can now be moved (standard title bar)."],
	},
	{
		version: "1.0.11",
		notes: [
			"Larger About window that leads with credit to the game's author.",
			"Expanded thanks: Patrick Hulin, Yoot Saito, and Don Hopkins.",
		],
	},
	{
		version: "1.0.9",
		notes: [
			"Added this What's New panel and an About-the-guide note.",
			"Added a Guide button on the build panel header.",
		],
	},
	{
		version: "1.0.8",
		notes: ["Added the in-app Help & Guide (this window)."],
	},
	{
		version: "1.0.6",
		notes: [
			"Per-effect Sound menu with on/off checkmarks.",
			"Click the tower name for the full About panel and credits.",
		],
	},
	{
		version: "1.0.5",
		notes: ["Uniform, evenly-sized build-panel buttons."],
	},
	{
		version: "1.0.4",
		notes: [
			"Mac-native typography and larger, clearer text.",
			"Settings window (⌘,) with interface scaling, launch speed, start muted.",
		],
	},
	{
		version: "1.0.3",
		notes: ["Cheats menu, named VIP roster, and an app icon."],
	},
	{
		version: "1.0.1",
		notes: ["Native title-bar polish; signed & notarized for Gatekeeper."],
	},
	{
		version: "1.0.0",
		notes: ["First release — offline single-player, native macOS."],
	},
];

const SECTIONS: Section[] = [
	{
		id: "whatsnew",
		title: "What's New",
		body: [
			{
				kind: "p",
				text: APP_VERSION
					? `You're playing version ${APP_VERSION}. Recent updates:`
					: "Recent updates to Senzall's Tower:",
			},
			{ kind: "changelog" },
			{
				kind: "p",
				text: "About this guide: everything here is written for this Mac edition and its actual mechanics. Open it any time from the ? button, the Guide button on the build panel, or Help → Senzall's Tower Guide (⌘?).",
			},
		],
	},
	{
		id: "start",
		title: "Getting Started",
		body: [
			{
				kind: "p",
				text: "You're the developer of a high-rise. Build facilities, attract tenants, keep them happy, and grow from a one-star building into a five-star tower — all without going bankrupt.",
			},
			{ kind: "h", text: "Your first steps" },
			{
				kind: "ul",
				items: [
					"Place a Lobby across the ground floor — it's the entrance every tenant uses.",
					"Add a few Offices on the floors just above the lobby.",
					"Connect them with Stairs (short trips) or an Elevator (taller towers).",
					"Unpause and let tenants move in; watch your cash and population climb.",
				],
			},
			{
				kind: "p",
				text: "New tenants take a little time to move in. Empty units show a FOR RENT / FOR SALE marker until occupied.",
			},
		],
	},
	{
		id: "building",
		title: "Building Basics",
		body: [
			{ kind: "h", text: "Placing & removing" },
			{
				kind: "ul",
				items: [
					"Pick a tool from the BUILD panel, then click a cell to place it.",
					"Shift-click along the same floor to fill an entire run in one stroke — great for long lobbies, floors, and corridors.",
					"Use Floor to lay bare floor/hallway, and Erase to remove a tile.",
					"Inspect (magnifier) shows details about any placed tile or tenant.",
				],
			},
			{ kind: "h", text: "Floors & foundations" },
			{
				kind: "ul",
				items: [
					"Rooms need a floor to sit on; build upward from the lobby.",
					"You can dig below ground for parking, services, and the metro.",
					"Every facility has a cost (shown in its tooltip) and some require a minimum star rating before they unlock.",
				],
			},
		],
	},
	{
		id: "lobby",
		title: "The Lobby & Sky Lobbies",
		body: [
			{
				kind: "p",
				text: "The lobby is the ground-floor concourse every visitor passes through. Make it larger by extending it horizontally — place lobby segments left and right (Shift-click to stretch a full-width lobby in one move).",
			},
			{ kind: "h", text: "Sky lobbies" },
			{
				kind: "p",
				text: "Tall towers need intermediate lobbies so people aren't riding a single elevator the whole way. Lobby tiles can only be placed on the ground floor and then every 15 floors up (floors 14, 29, 44, …). Build a sky lobby there and connect it with express elevators.",
			},
		],
	},
	{
		id: "transport",
		title: "Vertical Transport",
		body: [
			{
				kind: "p",
				text: "Moving tenants efficiently is the heart of the game. Long waits make tenants unhappy and hurt your rating.",
			},
			{
				kind: "ul",
				items: [
					"Stairs — cheap, for short hops (a few floors). No power, but slow and short-range.",
					"Escalators — smooth flow between adjacent commercial floors.",
					"Elevator — the workhorse; serves a range of floors. Add more cars to a shaft as traffic grows.",
					"Express Elevator — skips between lobbies/sky lobbies for long vertical trips.",
					"Service Elevator — keeps staff and deliveries out of the passenger elevators.",
				],
			},
			{ kind: "h", text: "Tuning elevators" },
			{
				kind: "p",
				text: "Inspect an elevator shaft to add/remove cars, set which floors it stops at, adjust its home floor, and change dwell timing. If you try to remove a car that still has active traffic, the game handles it for you.",
			},
		],
	},
	{
		id: "facilities",
		title: "Facilities",
		body: [
			{ kind: "h", text: "Income tenants" },
			{
				kind: "ul",
				items: [
					"Offices — steady daytime income; sensitive to commute time and noise.",
					"Condos — sold once for a lump sum; quiet neighbors matter.",
					"Hotel rooms (Single, Twin, Suite) — nightly income; must be cleaned by Housekeeping each day.",
				],
			},
			{ kind: "h", text: "Commercial & entertainment" },
			{
				kind: "ul",
				items: [
					"Fast Food, Restaurants, Shops (Retail) — draw crowds; do best near lobbies and offices.",
					"Cinema & Party Hall — big draws that need good access.",
				],
			},
			{ kind: "h", text: "Services & infrastructure" },
			{
				kind: "ul",
				items: [
					"Housekeeping — cleans hotel rooms (active late morning to mid-afternoon).",
					"Security — helps handle incidents.",
					"Recycling Center — handles the tower's waste.",
					"Parking & Parking Ramp — underground parking for visitors who drive.",
					"Metro — an underground station that brings in crowds (and the occasional VIP).",
				],
			},
		],
	},
	{
		id: "economy",
		title: "Economy & Rent",
		body: [
			{
				kind: "p",
				text: "You start with a large cash reserve. Building costs money up front; occupied units earn income on a recurring cycle, while facilities carry operating expenses.",
			},
			{
				kind: "ul",
				items: [
					"Rent is settled on a multi-day cycle — watch the trend, not a single tick.",
					"Inspect a unit to adjust its rent level. Too high and tenants leave; too low and you leave money on the table.",
					"Unhappy tenants (long commutes, noise, dirt, poor access) move out and cost you income.",
				],
			},
		],
	},
	{
		id: "stars",
		title: "Star Ratings & Growth",
		body: [
			{
				kind: "p",
				text: "Your tower is rated from 1 to 5 stars. Growing your population and keeping the books healthy advances your rating, which unlocks larger facilities.",
			},
			{
				kind: "ul",
				items: [
					"Higher stars unlock condos, hotels, entertainment, and more.",
					"Advancement checks your population and finances — steady, balanced growth is the path.",
					"Reaching the top rating is the endgame goal.",
				],
			},
		],
	},
	{
		id: "tenants",
		title: "Tenants, Evaluations & VIPs",
		body: [
			{
				kind: "p",
				text: "Tenants continuously evaluate their experience — mostly how long they wait and how far they travel. Inspect a unit to see how it's doing.",
			},
			{ kind: "h", text: "VIP guests" },
			{
				kind: "p",
				text: "Special VIP guests visit your tower — a named roster led by Senzall, the founder. A smooth, well-run tower makes a good impression. You can also summon a VIP any time from the Cheats menu.",
			},
		],
	},
	{
		id: "events",
		title: "Events",
		body: [
			{
				kind: "p",
				text: "Random events keep you on your toes. Some prompt you for a decision; others resolve on their own.",
			},
			{
				kind: "ul",
				items: [
					"Fire — respond quickly; Security and rescue help contain it.",
					"Bomb threat — a tense decision with a ransom option.",
					"VIP visits and metro arrivals — opportunities to show off your tower.",
				],
			},
		],
	},
	{
		id: "controls",
		title: "Controls & Shortcuts",
		body: [
			{ kind: "h", text: "Keyboard" },
			{
				kind: "ul",
				items: [
					"New Tower — ⌘N",
					"Save — ⌘S     Load — ⌘O",
					"Pause / Resume — ⌘P",
					"Speed: Normal ⌘1 · Fast ⌘2 · Ultra ⌘3",
					"Settings — ⌘,     Help — this window",
				],
			},
			{ kind: "h", text: "Mouse" },
			{
				kind: "ul",
				items: [
					"Click to place the selected tool; Shift-click to fill a run.",
					"Use Inspect to examine tiles, tenants, and elevators.",
				],
			},
		],
	},
	{
		id: "settings",
		title: "Settings & Sound",
		body: [
			{
				kind: "p",
				text: "Open Settings with ⌘,. Interface Size scales the whole game for readability. You can also set the speed the game starts at and whether it starts muted.",
			},
			{
				kind: "p",
				text: "The Sound menu lets you turn individual effect groups on or off — ambience, cash register, elevators, crowds, offices, food, hotels, shops, and services — each with its own checkmark.",
			},
		],
	},
	{
		id: "cheats",
		title: "Cheats",
		body: [
			{
				kind: "p",
				text: "For sandbox play, the Cheats menu offers:",
			},
			{
				kind: "ul",
				items: [
					"Grant $1,000,000 (⌘M) / $10,000,000 (⇧⌘M)",
					"Toggle Free Build (⇧⌘B) — place anything with no cost or star requirement",
					"Max Stars (⇧⌘5)",
					"Summon VIP (⇧⌘V)",
				],
			},
		],
	},
	{
		id: "about",
		title: "About & Credits",
		body: [
			{
				kind: "p",
				text: "Senzall's Tower is an independent, offline single-player Mac fork of a browser-based tower-building game. Click the tower's name in the top bar for the full About panel with detailed credits.",
			},
			{
				kind: "p",
				text: "Simulation engine: tower-together by Patrick Hulin (MIT) — a clean-room reimplementation that ships none of the original game's assets or code. This is his game; Senzall's Tower just packages it for the Mac.",
			},
			{
				kind: "p",
				text: "Inspired by the classic SimTower (“The Tower”, 1994) by Yoot Saito / OPeNBook, published by Maxis, and its sequel Yoot Tower (1998). Thanks to Yoot Saito for the games and for supporting their open-sourcing, and to Don Hopkins, who leads the effort to open-source and preserve the original sources. “SimTower” and “Yoot Tower” are trademarks of their respective owners; Senzall's Tower is not affiliated with or derived from them.",
			},
			{ kind: "h", text: "A note from the maker" },
			{
				kind: "p",
				text: "SimTower and Yoot Tower are among my favorite games of all time. I built this version for myself — to play my favorite game — and I wanted to share it with anyone who'd like to play it too. It's a privilege to work on it with Claude, bringing a new implementation to the Mac using modern AI tools.",
			},
		],
	},
];

interface Props {
	onClose: () => void;
}

export const HelpOverlay = memo(function HelpOverlay({ onClose }: Props) {
	const [active, setActive] = useState(SECTIONS[0].id);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

	return (
		<div style={S.scrim} onClick={onClose}>
			<div
				style={S.panel}
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-label="Senzall's Tower Help"
			>
				<div style={S.header}>
					<span style={S.title}>Senzall's Tower — Guide</span>
					<button
						type="button"
						style={S.close}
						onClick={onClose}
						aria-label="Close help"
					>
						✕
					</button>
				</div>
				<div style={S.body}>
					<nav style={S.nav}>
						{SECTIONS.map((s) => (
							<button
								type="button"
								key={s.id}
								style={{
									...S.navItem,
									...(s.id === active ? S.navItemActive : {}),
								}}
								onClick={() => setActive(s.id)}
							>
								{s.title}
							</button>
						))}
					</nav>
					<div style={S.content}>
						<h2 style={S.contentTitle}>{section.title}</h2>
						{section.body.map((block, i) => renderBlock(block, i))}
					</div>
				</div>
			</div>
		</div>
	);
});

function renderBlock(block: HelpBlock, key: number) {
	if (block.kind === "p")
		return (
			<p key={key} style={S.p}>
				{block.text}
			</p>
		);
	if (block.kind === "h")
		return (
			<h3 key={key} style={S.h}>
				{block.text}
			</h3>
		);
	if (block.kind === "changelog")
		return (
			<div key={key}>
				{CHANGELOG.map((entry) => (
					<div key={entry.version} style={S.change}>
						<div style={S.changeVersion}>v{entry.version}</div>
						<ul style={S.ul}>
							{entry.notes.map((note) => (
								<li key={note} style={S.li}>
									{note}
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		);
	return (
		<ul key={key} style={S.ul}>
			{block.items.map((item) => (
				<li key={item} style={S.li}>
					{item}
				</li>
			))}
		</ul>
	);
}

const S: Record<string, React.CSSProperties> = {
	scrim: {
		position: "absolute",
		inset: 0,
		background: "rgba(6, 9, 16, 0.6)",
		backdropFilter: "blur(3px)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		zIndex: 1000,
		pointerEvents: "auto",
	},
	panel: {
		width: "min(920px, 92vw)",
		height: "min(680px, 88vh)",
		display: "flex",
		flexDirection: "column",
		background: "#0e1218",
		border: "1px solid rgba(123, 148, 170, 0.4)",
		borderRadius: 12,
		boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
		overflow: "hidden",
		color: "#dbe6f0",
	},
	header: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "14px 18px",
		borderBottom: "1px solid rgba(123, 148, 170, 0.25)",
	},
	title: { fontSize: 16, fontWeight: 700, letterSpacing: "0.01em" },
	close: {
		border: "none",
		background: "transparent",
		color: "#aab8c2",
		fontSize: 16,
		cursor: "pointer",
		padding: 4,
	},
	body: { display: "flex", flex: 1, minHeight: 0 },
	nav: {
		width: 210,
		flexShrink: 0,
		borderRight: "1px solid rgba(123, 148, 170, 0.2)",
		padding: 8,
		overflowY: "auto",
		display: "flex",
		flexDirection: "column",
		gap: 2,
	},
	navItem: {
		textAlign: "left",
		padding: "8px 12px",
		borderRadius: 6,
		border: "none",
		background: "transparent",
		color: "#c9d6e2",
		fontSize: 13,
		fontWeight: 500,
		cursor: "pointer",
	},
	navItemActive: {
		background: "rgba(90, 130, 200, 0.22)",
		color: "#fff",
		fontWeight: 600,
	},
	content: { flex: 1, overflowY: "auto", padding: "18px 24px" },
	contentTitle: { fontSize: 20, fontWeight: 700, margin: "0 0 12px" },
	h: { fontSize: 14, fontWeight: 700, margin: "16px 0 6px", color: "#eef4fa" },
	p: { fontSize: 14, lineHeight: 1.6, margin: "0 0 10px", color: "#c6d2de" },
	ul: { margin: "0 0 10px", paddingLeft: 20 },
	li: { fontSize: 14, lineHeight: 1.6, marginBottom: 4, color: "#c6d2de" },
	change: { marginBottom: 12 },
	changeVersion: {
		fontSize: 13,
		fontWeight: 700,
		color: "#8fb4e0",
		marginBottom: 2,
		fontVariantNumeric: "tabular-nums",
	},
};
