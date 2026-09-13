import { AppBackground } from "@/components/ui/tailwind-css-background-snippet";
﻿import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./hooks";
import "./styles.css";
import './background.css';

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppBackground /><App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
