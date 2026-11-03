import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import { Home } from "./Home";
import { navigate, usePath } from "./router";
import { SessionView } from "./SessionView";
import "./styles.css";

function App() {
  const path = usePath();
  const session = path.match(/^\/s\/([a-f0-9]{12})$/);
  const [model, setModel] = useState("…");
  useEffect(() => {
    api.health().then((h) => setModel(h.model)).catch(() => setModel("offline"));
  }, []);

  return (
    <>
      <header className="titleblock">
        <button className="brand" onClick={() => navigate("/")}>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M6 24l10-16 10 16z" />
            <circle cx="16" cy="8" r="2.4" />
          </svg>
          <span>
            Skill<b>Smith</b>
          </span>
        </button>
        <dl>
          <div>
            <dt>Drawing</dt>
            <dd>{session ? `SS-${session[1].slice(0, 6).toUpperCase()}` : "Register"}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>Agent Skills</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{model}</dd>
          </div>
        </dl>
      </header>
      {session ? <SessionView key={session[1]} id={session[1]} /> : <Home />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
