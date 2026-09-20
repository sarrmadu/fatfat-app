"use client";

import { useState } from "react";

export default function PasswordModal({ api, onClose }) {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function confirmer() {
    setError(null);
    try {
      await api("/auth/mot-de-passe", {
        method: "PATCH",
        body: { ancien_mot_de_passe: ancien, nouveau_mot_de_passe: nouveau },
      });
      setSuccess(true);
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="password-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="password-modal-card">
        <h2>Changer mon mot de passe</h2>
        <input type="password" placeholder="Ancien mot de passe" value={ancien} onChange={(e) => setAncien(e.target.value)} />
        <input type="password" placeholder="Nouveau mot de passe (min. 6 caractères)" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="config-status ok">Mot de passe mis à jour ✓</div>}
        <div className="pending-actions">
          <button className="btn btn-primary" onClick={confirmer}>Confirmer</button>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
