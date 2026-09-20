"use client";

import { useState, useEffect, useCallback } from "react";

export default function LivreursTab({ api }) {
  const [livreurs, setLivreurs] = useState(null);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTelId, setEditingTelId] = useState(null);

  const charger = useCallback(async () => {
    try {
      setLivreurs(await api("/utilisateurs/livreurs"));
    } catch (err) {
      setError(err.message);
    }
  }, [api]);

  useEffect(() => { charger(); }, [charger]);

  async function toggleActif(livreur) {
    try {
      await api(`/utilisateurs/livreurs/${livreur.id}/statut`, { method: "PATCH", body: { actif: !livreur.actif } });
      charger();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Livreurs</div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>+ Ajouter un livreur</button>
      </div>

      {showForm && (
        <CreationForm
          api={api}
          onCreated={() => { setShowForm(false); charger(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error && <div className="auth-error" style={{ margin: 16 }}>{error}</div>}
      {!livreurs && !error && <div className="loading-note">Chargement...</div>}
      {livreurs && livreurs.length === 0 && <div className="empty-state">Aucun livreur enregistré.</div>}

      {livreurs && livreurs.length > 0 && (
        <div className="manifest">
          {livreurs.map((l) => (
            <div key={l.id}>
              <div className="order-row">
                <div className={`tag ${l.actif ? "" : "unopt"}`}>
                  <span>{l.nom.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                </div>
                <div className="order-info">
                  <div className="order-name">
                    {l.nom} {!l.actif && <span style={{ color: "var(--hibiscus)", fontSize: 11 }}>(désactivé)</span>}
                  </div>
                  <div className="order-meta">
                    {l.telephone} · capacité : {l.capacite_max ? `${l.capacite_max} colis` : "illimitée"}
                  </div>
                </div>
                <button className="link-subtle" onClick={() => setEditingTelId(editingTelId === l.id ? null : l.id)}>
                  Modifier n°
                </button>
                <button className="btn-danger-text" onClick={() => toggleActif(l)}>
                  {l.actif ? "Désactiver" : "Réactiver"}
                </button>
              </div>
              {editingTelId === l.id && (
                <TelephoneEditForm
                  api={api}
                  livreur={l}
                  onDone={() => { setEditingTelId(null); charger(); }}
                  onCancel={() => setEditingTelId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TelephoneEditForm({ api, livreur, onDone, onCancel }) {
  const [nouveauTelephone, setNouveauTelephone] = useState(livreur.telephone);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function confirmer() {
    setError(null);
    setSaving(true);
    try {
      await api(`/utilisateurs/livreurs/${livreur.id}/telephone`, {
        method: "PATCH",
        body: { nouveau_telephone: nouveauTelephone.trim() },
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pending-panel" style={{ marginTop: -4, marginBottom: 8 }}>
      <div className="coords">
        Nouveau numéro pour {livreur.nom} — utile si son numéro d'origine est perdu ou changé.
      </div>
      <input value={nouveauTelephone} onChange={(e) => setNouveauTelephone(e.target.value)} placeholder="Nouveau numéro" />
      <div className="pending-actions">
        <button className="btn btn-primary" disabled={saving} onClick={confirmer}>
          {saving ? "Enregistrement..." : "Confirmer"}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Annuler</button>
      </div>
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}

function CreationForm({ api, onCreated, onCancel }) {
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [pass, setPass] = useState("");
  const [capacite, setCapacite] = useState("");
  const [error, setError] = useState(null);

  async function creer() {
    setError(null);
    try {
      await api("/utilisateurs/livreurs", {
        method: "POST",
        body: { nom, telephone: tel, mot_de_passe: pass, capacite_max: capacite ? Number(capacite) : null },
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="pending-panel">
      <input placeholder="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} />
      <input placeholder="Téléphone" value={tel} onChange={(e) => setTel(e.target.value)} />
      <input placeholder="Mot de passe initial (min. 6 caractères)" value={pass} onChange={(e) => setPass(e.target.value)} />
      <input type="number" min="1" placeholder="Capacité max de colis (optionnel)" value={capacite} onChange={(e) => setCapacite(e.target.value)} />
      <div className="pending-actions">
        <button className="btn btn-primary" onClick={creer}>Créer le compte</button>
        <button className="btn btn-ghost" onClick={onCancel}>Annuler</button>
      </div>
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}
