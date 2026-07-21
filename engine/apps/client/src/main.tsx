import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installNativeBridge } from "./local/nativeBridge";

// Expose window.senzall for the native macOS shell (no-op in a browser).
installNativeBridge();

const root = document.getElementById("root");
if (!root) throw new Error("No #root element found");

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
