"use client";

import { useState, useEffect } from "react";

export default function StatsTab({ api }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/stats").then(setStats).catch((err) => setError(err.message));
  }, [api]);

  return (
    <div className="card">
      <div className="card-head"><div className="card-title">Statistiques du jour</div></div>

      {error && <div className="auth-error" style={{ margin: 16 }}>{error}</div>}
      {!stats && !error && <div className="loading-note">Chargement...</div>}

      {stats && (
        <div className="stats-grid">
          <Tile value={stats.total_commandes} label="Commandes du jour" />
          <Tile value={`${stats.taux_livraison_pct}%`} label="Taux de livraison" />
          <Tile value={stats.par_statut.echec} label="Échecs" />
          <Tile value={stats.nb_tournees} label="Tournées créées" />
          <Tile value={`${stats.distance_totale_km.toFixed(1)} km`} label="Distance totale" />
          <Tile value={stats.par_statut.attente + stats.par_statut.encours} label="Encore à livrer" />
        </div>
      )}
    </div>
  );
}

function Tile({ value, label }) {
  return (
    <div className="stat-tile">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
