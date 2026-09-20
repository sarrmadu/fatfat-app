"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("../MapView"), {
  ssr: false,
  loading: () => <div className="loading-note">Chargement de la carte...</div>,
});

export default function AdminView({ api }) {
  const [entreprises, setEntreprises] = useState(null);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const charger = useCallback(async () => {
    try {
      setEntreprises(await api("/admin/entreprises"));
    } catch (err) {
      setError(err.message);
    }
  }, [api]);

  useEffect(() => { charger(); }, [charger]);

  async function toggleActif(entreprise) {
    try {
      await api(`/admin/entreprises/${entreprise.id}/statut`, { method: "PATCH", body: { actif: !entreprise.actif } });
      await charger();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Entreprises clientes</div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Annuler" : "+ Nouvelle entreprise"}
        </button>
      </div>

      {showForm && (
        <NouvelleEntrepriseForm
          api={api}
          onCreated={() => { setShowForm(false); charger(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error && <div className="auth-error" style={{ margin: 16 }}>{error}</div>}
      {!entreprises && !error && <div className="loading-note">Chargement...</div>}
      {entreprises && entreprises.length === 0 && (
        <div className="empty-state">Aucune entreprise cliente pour l'instant.</div>
      )}

      {entreprises && entreprises.length > 0 && (
        <div className="manifest">
          {entreprises.map((e) => (
            <div className="order-row" key={e.id}>
              <div className={`tag ${e.actif ? "" : "unopt"}`}>
                <span>{e.nom.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
              </div>
              <div className="order-info">
                <div className="order-name">
                  {e.nom} {!e.actif && <span style={{ color: "var(--hibiscus)", fontSize: 11 }}>(désactivée)</span>}
                </div>
                <div className="order-meta">
                  {e.ville_nom} · {e.hub_nom} · {e.nb_gestionnaires} gestionnaire(s), {e.nb_livreurs} livreur(s)
                </div>
              </div>
              <button className="btn-danger-text" onClick={() => toggleActif(e)}>
                {e.actif ? "Désactiver" : "Réactiver"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NouvelleEntrepriseForm({ api, onCreated, onCancel }) {
  const [villes, setVilles] = useState(null);
  const [nom, setNom] = useState("");
  const [villeId, setVilleId] = useState("");
  const [hubNom, setHubNom] = useState("");
  const [hubPos, setHubPos] = useState(null);
  const [gestNom, setGestNom] = useState("");
  const [gestTel, setGestTel] = useState("");
  const [gestPass, setGestPass] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/admin/villes").then((v) => { setVilles(v); if (v.length) setVilleId(String(v[0].id)); }).catch((e) => setError(e.message));
  }, [api]);

  const villeChoisie = villes?.find((v) => String(v.id) === String(villeId));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!hubPos) { setError("Indiquez le hub sur la carte."); return; }
    setSaving(true);
    try {
      await api("/admin/entreprises", {
        method: "POST",
        body: {
          nom,
          ville_id: Number(villeId),
          hub_nom: hubNom,
          hub_lat: hubPos.lat,
          hub_lng: hubPos.lng,
          gestionnaire: { nom: gestNom, telephone: gestTel, mot_de_passe: gestPass },
        },
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="pending-panel" onSubmit={handleSubmit} style={{ margin: 16 }}>
      <input placeholder="Nom de l'entreprise" value={nom} onChange={(e) => setNom(e.target.value)} required />

      {villes && (
        <select value={villeId} onChange={(e) => { setVilleId(e.target.value); setHubPos(null); }}>
          {villes.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
        </select>
      )}

      <input placeholder="Nom du hub (ex: Hub Plateau)" value={hubNom} onChange={(e) => setHubNom(e.target.value)} required />

      {villeChoisie && (
        <div className="picker-map">
          <MapView
            entrepriseInfo={{ centre_latitude: villeChoisie.centre_latitude, centre_longitude: villeChoisie.centre_longitude, zoom_defaut: villeChoisie.zoom_defaut }}
            pickerPos={hubPos}
            showHub={false}
            onMapClick={(lat, lng) => setHubPos({ lat, lng })}
          />
        </div>
      )}
      <div className="picker-hint">Cliquez sur la carte pour indiquer le hub de départ des tournées.</div>

      <div style={{ borderTop: "1px dashed var(--line)", margin: "10px 0", paddingTop: 10 }}>
        <div className="entreprise-group-title">Premier compte gestionnaire</div>
        <input placeholder="Nom complet" value={gestNom} onChange={(e) => setGestNom(e.target.value)} required />
        <input placeholder="Téléphone" value={gestTel} onChange={(e) => setGestTel(e.target.value)} required />
        <input type="password" placeholder="Mot de passe initial (min. 6 caractères)" value={gestPass} onChange={(e) => setGestPass(e.target.value)} required />
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="pending-actions">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Création..." : "Créer l'entreprise"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
