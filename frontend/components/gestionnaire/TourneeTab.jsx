"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("../MapView"), {
  ssr: false,
  loading: () => <div className="loading-note">Chargement de la carte...</div>,
});

export default function TourneeTab({ api, entrepriseInfo }) {
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [preview, setPreview] = useState(null); // { distance_km, etapes: [...] }
  const [optimizing, setOptimizing] = useState(false);

  const chargerCommandes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/commandes");
      setCommandes(data);
      setPreview(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { chargerCommandes(); }, [chargerCommandes]);

  async function handleAjouterCommande(form) {
    await api("/commandes", { method: "POST", body: { ...form, lat: pendingPoint.lat, lng: pendingPoint.lng } });
    setPendingPoint(null);
    await chargerCommandes();
  }

  async function handleSupprimer(id) {
    await api(`/commandes/${id}`, { method: "DELETE" });
    await chargerCommandes();
  }

  async function lancerOptimisation() {
    setOptimizing(true);
    try {
      const commande_ids = commandes.map((c) => c.id);
      const result = await api("/tournees/optimiser", { method: "POST", body: { commande_ids } });
      setPreview(result);
    } catch (err) {
      alert(err.message);
    } finally {
      setOptimizing(false);
    }
  }

  const displayedStops = preview ? preview.etapes : commandes;
  const optimized = !!preview;

  return (
    <div>
      <SuiviTournees api={api} />
      <div className="console">
      <div className="card">
        <div className="card-head"><div className="card-title">Carte — {entrepriseInfo.ville_nom}</div></div>
        <div className="card-hint">
          Cliquez sur la carte pour poser un repère de livraison.
          {entrepriseInfo.ville_nom === "Mbour" && " Le fond OpenStreetMap est peu détaillé ici — basculez sur « Satellite » en haut à droite."}
        </div>

        {pendingPoint && (
          <PendingPointForm
            point={pendingPoint}
            onCancel={() => setPendingPoint(null)}
            onSubmit={handleAjouterCommande}
          />
        )}

        <MapView
          entrepriseInfo={entrepriseInfo}
          stops={displayedStops.map((s) => ({
            id: s.id || s.commande_id,
            lat: s.lat,
            lng: s.lng,
            nom_client: s.nom_client,
            repere: s.repere,
          }))}
          optimized={optimized}
          onMapClick={(lat, lng) => setPendingPoint({ lat, lng })}
        />
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">Bordereau du jour</div></div>

        {loading && <div className="loading-note">Chargement des commandes...</div>}
        {error && <div className="auth-error" style={{ margin: 16 }}>{error}</div>}

        {!loading && !error && displayedStops.length === 0 && (
          <div className="empty-state">
            Aucune commande pour {entrepriseInfo.nom} aujourd'hui.<br />
            Cliquez sur la carte pour poser votre premier repère.
          </div>
        )}

        {!loading && !error && displayedStops.length > 0 && (
          <div className="manifest">
            {displayedStops.map((s, i) => (
              <div className="order-row" key={s.id || s.commande_id}>
                <div className={`tag ${optimized ? "" : "unopt"}`}><span>{optimized ? i + 1 : "•"}</span></div>
                <div className="order-info">
                  <div className="order-name">{s.nom_client}</div>
                  <div className="order-meta">{s.telephone_client || "—"} · {s.lat.toFixed(4)}, {s.lng.toFixed(4)}</div>
                  {s.repere && <div className="order-repere">{s.repere}</div>}
                </div>
                {!optimized && (
                  <button className="btn-danger-text" onClick={() => handleSupprimer(s.id)}>Retirer</button>
                )}
              </div>
            ))}
          </div>
        )}

        {optimized && (
          <div className="stat-bar">
            <span><b>{displayedStops.length}</b> arrêts</span>
            <span><b>{preview.distance_km} km</b> estimés</span>
            <span>Départ : <b>{entrepriseInfo.hub_nom}</b></span>
          </div>
        )}

        {optimized && <AssignPanel api={api} preview={preview} />}

        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={commandes.length < 2 || optimizing} onClick={lancerOptimisation}>
            {optimizing ? "Calcul en cours..." : "Optimiser la tournée"}
          </button>
          <button className="btn btn-ghost" onClick={chargerCommandes}>Rafraîchir</button>
        </div>
      </div>
      </div>
    </div>
  );
}

function PendingPointForm({ point, onCancel, onSubmit }) {
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [repere, setRepere] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function ajouter() {
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        nom_client: nom.trim() || "Client sans nom",
        telephone_client: tel.trim() || null,
        repere: repere.trim() || null,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="pending-panel">
      <div className="coords">Nouveau repère — {point.lat.toFixed(5)}, {point.lng.toFixed(5)}</div>
      <input placeholder="Nom du client" value={nom} onChange={(e) => setNom(e.target.value)} />
      <input placeholder="Téléphone" value={tel} onChange={(e) => setTel(e.target.value)} />
      <input placeholder="Repère (ex: face à la pharmacie, portail bleu)" value={repere} onChange={(e) => setRepere(e.target.value)} />
      <div className="pending-actions">
        <button className="btn btn-primary" disabled={saving} onClick={ajouter}>Ajouter au bordereau</button>
        <button className="btn btn-ghost" onClick={onCancel}>Annuler</button>
      </div>
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}

function SuiviTournees({ api }) {
  const [tournees, setTournees] = useState(null);
  const [error, setError] = useState(null);

  const charger = useCallback(async () => {
    try {
      setTournees(await api("/tournees/suivi"));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [api]);

  useEffect(() => {
    charger();
    // Sondage automatique : le gestionnaire voit une tournée passer à "Terminée"
    // sans avoir à recharger la page ni à appeler le livreur pour savoir où il en est.
    const interval = setInterval(charger, 15000);
    return () => clearInterval(interval);
  }, [charger]);

  if (error) return null; // discret : ne bloque pas le reste de l'onglet si ça échoue
  if (!tournees || tournees.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head"><div className="card-title">Tournées en cours aujourd'hui</div></div>
      <div className="manifest">
        {tournees.map((t) => (
          <div className="order-row" key={t.id}>
            <div className={`tag ${t.statut === "terminee" ? "" : "unopt"}`}>
              <span>{t.statut === "terminee" ? "✓" : "…"}</span>
            </div>
            <div className="order-info">
              <div className="order-name">{t.livreur_nom}</div>
              <div className="order-meta">
                {t.nb_livrees} / {t.nb_arrets} livrées
                {t.nb_echecs > 0 && ` · ${t.nb_echecs} échec(s)`}
              </div>
            </div>
            <div className={`status-pill ${t.statut === "terminee" ? "livre" : "encours"}`}>
              {t.statut === "terminee" ? "Terminée" : "En cours"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignPanel({ api, preview }) {
  const [livreurs, setLivreurs] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api("/utilisateurs/livreurs")
      .then((data) => {
        const actifs = data.filter((l) => l.actif);
        setLivreurs(actifs);
        if (actifs.length) setSelected(actifs[0].id);
      })
      .catch((err) => setError(err.message));
    setResult(null);
  }, [api, preview]);

  async function assigner() {
    setError(null);
    try {
      await api("/tournees", {
        method: "POST",
        body: {
          livreur_id: Number(selected),
          commande_ids: preview.etapes.map((e) => e.commande_id),
          distance_km: preview.distance_km,
        },
      });
      setResult("✓ Tournée assignée — visible côté livreur dans « Poste Livreur ».");
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !livreurs) return <div className="auth-error" style={{ margin: 16 }}>{error}</div>;
  if (!livreurs) return <div className="loading-note">Chargement des livreurs...</div>;
  if (!livreurs.length) return <div className="empty-state">Aucun livreur actif dans cette ville.</div>;

  return (
    <>
      <div className="assign-row">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {livreurs.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
        </select>
        <button className="btn btn-primary" onClick={assigner}>Assigner la tournée</button>
      </div>
      {result && <div className="assigned-note">{result}</div>}
      {error && <div className="auth-error" style={{ margin: 16 }}>{error}</div>}
    </>
  );
}
