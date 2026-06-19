// Entry wiring: mount the app with router + study store provider. No logic.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { StudyStoreProvider } from "@/store/StudyStoreProvider";
import App from "@/App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <StudyStoreProvider>
        <App />
      </StudyStoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
