"use client";

import { useState, useEffect } from "react";

export default function HistoriqueTab({ api }) {
  const [tournees, setTournees] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/tournees/historique").then(setTournees).catch((err) => setError(err.message));
  }, [api]);

  return (
    <div className="card">
      <div className="card-head"><div className="card-title">Historique des tournées</div></div>

      {error && <div className="auth-error" style={{ margin: 16 }}>{error}</div>}
      {!tournees && !error && <div className="loading-note">Chargement...</div>}
      {tournees && tournees.length === 0 && (
        <div className="empty-state">Aucune tournée enregistrée sur les 30 derniers jours.</div>
      )}

      {tournees && tournees.length > 0 && (
        <div className="manifest">
          {tournees.map((t) => (
            <div className="order-row" key={t.id}>
              <div className="order-info">
                <div className="order-name">
                  {new Date(t.date_creation).toLocaleDateString("fr-FR")} — {t.livreur_nom}
                </div>
                <div className="order-meta">
                  {t.nb_arrets} arrêts · {t.distance_km ? `${t.distance_km} km` : "distance non enregistrée"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
