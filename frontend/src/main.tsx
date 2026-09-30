import React from "react";
import ReactDOM from "react-dom/client";
import App from "./components/AuthenticatedApp";
import { PreferencesProvider } from "./context/PreferencesContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </React.StrictMode>,
);
