import React from "react";
import { createRoot } from "react-dom/client";
import AuthCallback from "./auth-callback.jsx";
import PetCareLanding from "./react.jsx";
import PetCareDashboard from "./dashboard.jsx";

const route = window.location.pathname.replace(/\/+$/, "") || "/";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {route === "/dashboard" ? <PetCareDashboard /> : route === "/auth/callback" ? <AuthCallback /> : <PetCareLanding />}
  </React.StrictMode>,
);
