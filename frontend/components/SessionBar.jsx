"use client";

import { useState } from "react";
import PasswordModal from "./PasswordModal";

export default function SessionBar({ session, entrepriseInfo, api, onLogout }) {
  const [showPwd, setShowPwd] = useState(false);
  const isAdmin = session.utilisateur.role === "admin";

  return (
    <div className="session">
      <div className="city-badge">
        <span className="dot"></span>
        {isAdmin ? "Administrateur" : `${session.utilisateur.entreprise_nom} · ${session.utilisateur.ville_nom}`}
      </div>
      <div className="user-chip">
        <div className="who">
          <div className="name">{session.utilisateur.nom}</div>
          <div className="role">
            {isAdmin ? "Admin" : session.utilisateur.role === "gestionnaire" ? "Gestionnaire" : "Livreur"} ·{" "}
            <button className="btn-textlink" onClick={() => setShowPwd(true)}>changer mon mot de passe</button>
          </div>
        </div>
        <button className="btn-logout" onClick={onLogout}>Changer de compte</button>
      </div>
      {showPwd && <PasswordModal api={api} onClose={() => setShowPwd(false)} />}
    </div>
  );
}
