"use client";

import { useState } from "react";
import TourneeTab from "./TourneeTab";
import LivreursTab from "./LivreursTab";
import HistoriqueTab from "./HistoriqueTab";
import StatsTab from "./StatsTab";

const TABS = [
  { id: "tournee", label: "Tournée du jour" },
  { id: "livreurs", label: "Livreurs" },
  { id: "historique", label: "Historique" },
  { id: "stats", label: "Statistiques" },
];

export default function GestionnaireView({ api, entrepriseInfo }) {
  const [tab, setTab] = useState("tournee");

  return (
    <div>
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tournee" && <TourneeTab api={api} entrepriseInfo={entrepriseInfo} />}
      {tab === "livreurs" && <LivreursTab api={api} entrepriseInfo={entrepriseInfo} />}
      {tab === "historique" && <HistoriqueTab api={api} entrepriseInfo={entrepriseInfo} />}
      {tab === "stats" && <StatsTab api={api} entrepriseInfo={entrepriseInfo} />}
    </div>
  );
}
