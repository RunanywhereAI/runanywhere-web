import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

import "./styles/index.css";
import "./features/nutrition/nutrition.css";
import "./components/app-shell.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);