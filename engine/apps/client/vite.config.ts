import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	// Relative asset URLs so the built bundle loads under file:// inside a
	// WKWebView (Senzall's Tower native shell).
	base: "./",
	plugins: [react()],
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: "http://localhost:8787",
				changeOrigin: true,
				ws: true,
			},
		},
	},
});
