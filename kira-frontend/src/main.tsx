import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { Provider as UrqlProvider } from "urql";
import { BrowserRouter } from "react-router-dom";

import { kiraTheme } from "./theme";
import { urqlClient } from "./lib/urqlClient";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UrqlProvider value={urqlClient}>
      <ThemeProvider theme={kiraTheme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </UrqlProvider>
  </React.StrictMode>
);
