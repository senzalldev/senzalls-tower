import { useCallback, useEffect, useRef, useState } from "react";
import type { SimSnapshot } from "../../worker/src/sim/index";
import { type GameSocket, TowerSocket } from "./lib/socket";
import { getDisplayName, getPlayerId } from "./lib/storage";
import type { LocalTowerSocket } from "./local/LocalTowerSocket";
import {
	createLocalSocket,
	IS_LOCAL,
	LOCAL_PLAYER_ID,
	LOCAL_PLAYER_NAME,
	LOCAL_TOWER_ID,
} from "./local/localBootstrap";
import { senzall } from "./local/nativeBridge";
import { GameScreen } from "./screens/GameScreen";
import { GuestScreen } from "./screens/GuestScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import type { SelectedTool } from "./types";

type Screen = "guest" | "lobby" | "game";
type HistoryMode = "none" | "push" | "replace";

function getSlugFromPath(): string {
	const path = window.location.pathname;
	if (path === "/") return "";
	if (!path.startsWith("/")) return "";

	const slug = path.slice(1);
	if (!slug || slug.includes("/")) return "";

	try {
		return decodeURIComponent(slug);
	} catch {
		return "";
	}
}

function updateHistory(path: string, mode: HistoryMode) {
	if (mode === "push") {
		window.history.pushState(null, "", path);
	} else if (mode === "replace") {
		window.history.replaceState(null, "", path);
	}
}

async function resolveSlug(slug: string): Promise<string | null> {
	try {
		const res = await fetch(`/api/resolve/${encodeURIComponent(slug)}`);
		if (!res.ok) return null;
		const data = (await res.json()) as { towerId: string };
		return data.towerId;
	} catch {
		return null;
	}
}

export function App() {
	const socketRef = useRef<GameSocket>(
		IS_LOCAL ? createLocalSocket() : new TowerSocket(),
	);
	const socket = socketRef.current;
	const [screen, setScreen] = useState<Screen>("guest");
	const [playerId, setPlayerId] = useState<string>("");
	const [displayName, setDisplayName] = useState<string>("");
	const [towerId, setTowerId] = useState<string>("");
	const [initialTool, setInitialTool] = useState<SelectedTool | undefined>(
		undefined,
	);
	// Local single-player only: bump to force a fresh GameScreen/session (New/Load).
	const [sessionKey, setSessionKey] = useState(0);
	const pausedRef = useRef(false);

	const enterTower = useCallback(
		(
			nextTowerId: string,
			historyMode: HistoryMode = "none",
			nextInitialTool?: SelectedTool,
		) => {
			socket.connect(nextTowerId);
			setTowerId(nextTowerId);
			setInitialTool(nextInitialTool);
			setScreen("game");
			updateHistory(`/${nextTowerId}`, historyMode);
		},
		[socket],
	);

	// Local single-player: (re)start a session, optionally from a saved snapshot.
	const startLocalSession = useCallback((snapshot?: SimSnapshot | null) => {
		socketRef.current.disconnect();
		socketRef.current = createLocalSocket(snapshot);
		pausedRef.current = false;
		setPlayerId(LOCAL_PLAYER_ID);
		setDisplayName(LOCAL_PLAYER_NAME);
		socketRef.current.connect(LOCAL_TOWER_ID);
		setTowerId(LOCAL_TOWER_ID);
		setScreen("game");
		setSessionKey((key) => key + 1);
	}, []);

	const moveToLobby = useCallback(
		(historyMode: HistoryMode = "none") => {
			socket.disconnect();
			setTowerId("");
			setScreen("lobby");
			updateHistory("/", historyMode);
		},
		[socket],
	);

	const moveToGuest = useCallback(
		(historyMode: HistoryMode = "none") => {
			socket.disconnect();
			setTowerId("");
			setScreen("guest");
			updateHistory("/", historyMode);
		},
		[socket],
	);

	const syncFromLocation = useCallback(
		async (hasPlayer: boolean) => {
			if (!hasPlayer) {
				moveToGuest();
				return;
			}

			const slug = getSlugFromPath();
			if (!slug) {
				moveToLobby();
				return;
			}

			const resolvedTowerId = await resolveSlug(slug);
			if (resolvedTowerId) {
				enterTower(resolvedTowerId);
			} else {
				moveToLobby();
			}
		},
		[enterTower, moveToGuest, moveToLobby],
	);

	useEffect(() => {
		if (IS_LOCAL) {
			// Offline single-player: skip guest/lobby, resume the autosave if any.
			let cancelled = false;
			void senzall.load("autosave").then((saved) => {
				if (cancelled) return;
				let snapshot: SimSnapshot | null = null;
				if (saved) {
					try {
						snapshot = JSON.parse(saved) as SimSnapshot;
					} catch {
						snapshot = null;
					}
				}
				startLocalSession(snapshot);
			});

			senzall.onMenu((action) => {
				const active = socketRef.current;
				switch (action) {
					case "pause":
						pausedRef.current = !pausedRef.current;
						active.send({ type: "set_paused", paused: pausedRef.current });
						break;
					case "speed1":
						active.send({ type: "set_speed", multiplier: 1 });
						break;
					case "speed3":
						active.send({ type: "set_speed", multiplier: 3 });
						break;
					case "speed10":
						active.send({ type: "set_speed", multiplier: 10 });
						break;
					case "save": {
						const snap = (active as LocalTowerSocket).getSnapshot();
						if (snap) void senzall.save("autosave", JSON.stringify(snap));
						break;
					}
					case "newTower":
						startLocalSession(null);
						break;
					case "load":
						void senzall.load("autosave").then((saved) => {
							if (!saved) return;
							try {
								startLocalSession(JSON.parse(saved) as SimSnapshot);
							} catch {
								// ignore corrupt save
							}
						});
						break;
				}
			});

			const autosaveTimer = setInterval(() => {
				const snap = (socketRef.current as LocalTowerSocket).getSnapshot();
				if (snap) void senzall.autosave(JSON.stringify(snap));
			}, 60_000);

			return () => {
				cancelled = true;
				clearInterval(autosaveTimer);
				socketRef.current.disconnect();
			};
		}

		const storedId = getPlayerId();
		const storedName = getDisplayName();
		if (storedId && storedName) {
			setPlayerId(storedId);
			setDisplayName(storedName);
			void syncFromLocation(true);
		}

		return () => {
			socket.disconnect();
		};
	}, [socket, syncFromLocation, startLocalSession]);

	useEffect(() => {
		function onPopState() {
			void syncFromLocation(Boolean(playerId && displayName));
		}

		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, [displayName, playerId, syncFromLocation]);

	function handleGuestEnter(id: string, name: string) {
		setPlayerId(id);
		setDisplayName(name);
		void syncFromLocation(true);
	}

	function handleJoinTower(id: string) {
		enterTower(id, "push");
	}

	function handleCreateTower(id: string) {
		enterTower(id, "push", "lobby");
	}

	function handleLeaveGame() {
		moveToLobby("push");
	}

	function handleLogout() {
		setPlayerId("");
		setDisplayName("");
		moveToGuest("push");
	}

	switch (screen) {
		case "guest":
			return <GuestScreen onEnter={handleGuestEnter} />;
		case "lobby":
			return (
				<LobbyScreen
					displayName={displayName}
					onJoinTower={handleJoinTower}
					onCreateTower={handleCreateTower}
					onLogout={handleLogout}
				/>
			);
		case "game":
			return (
				<GameScreen
					key={sessionKey}
					playerId={playerId}
					displayName={displayName}
					socket={socketRef.current}
					towerId={towerId}
					initialTool={initialTool}
					onLeave={handleLeaveGame}
				/>
			);
	}
}
