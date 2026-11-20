import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { ToastProvider } from "./components/ui/ToastProvider";
import { ThemeProvider } from "./features/theme/ThemeProvider";
// @ts-expect-error CSS is processed by the bundler.
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
