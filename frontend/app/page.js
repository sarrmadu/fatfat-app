"use client";

import { useState, useEffect, useCallback } from "react";
import { apiCall } from "../lib/api";
import LoginScreen from "../components/LoginScreen";
import SessionBar from "../components/SessionBar";
import GestionnaireView from "../components/gestionnaire/GestionnaireView";
import LivreurView from "../components/livreur/LivreurView";
import AdminView from "../components/admin/AdminView";

// L'URL de l'API vient uniquement de la configuration du serveur (NEXT_PUBLIC_API_BASE_URL
// dans .env.local), jamais d'un écran visible par l'utilisateur final — ce n'est pas une
// information qu'un gestionnaire ou un livreur a besoin de voir ou de pouvoir modifier.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function Home() {
  const [session, setSession] = useState(null);         // { token, utilisateur: {...} }
  const [entrepriseInfo, setEntrepriseInfo] = useState(null); // hub + ville de SA propre entreprise (null pour un admin)
  const [ready, setReady] = useState(false);

  // Au premier rendu, on relit une session déjà ouverte (localStorage) si elle existe —
  // ça évite de se reconnecter à chaque rechargement de page.
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem("fatfat_session");
      const savedEntreprise = localStorage.getItem("fatfat_entreprise_info");
      if (savedSession) setSession(JSON.parse(savedSession));
      if (savedEntreprise) setEntrepriseInfo(JSON.parse(savedEntreprise));
    } catch (e) {
      /* localStorage indisponible (mode privé strict, etc.) — on repart d'un écran vierge */
    }
    setReady(true);
  }, []);

  const api = useCallback(
    (path, opts) => apiCall(API_BASE_URL, path, { ...opts, token: session?.token }),
    [session]
  );

  // Filet de sécurité : si une session existe (restaurée du localStorage) mais que
  // l'info d'entreprise, elle, n'a pas survécu (navigateur fermé au mauvais moment,
  // ancien cache, etc.), on la recharge automatiquement au lieu de laisser l'écran
  // vide sans explication. Si le token s'avère invalide/expiré entre-temps, on
  // déconnecte proprement plutôt que de rester bloqué indéfiniment.
  useEffect(() => {
    if (!ready || !session) return;
    if (session.utilisateur.role === "admin") return;
    if (entrepriseInfo) return;

    let annule = false;
    apiCall(API_BASE_URL, "/entreprises/moi", { token: session.token })
      .then((entreprise) => {
        if (annule) return;
        setEntrepriseInfo(entreprise);
        try { localStorage.setItem("fatfat_entreprise_info", JSON.stringify(entreprise)); } catch (e) {}
      })
      .catch(() => {
        if (annule) return;
        handleLogout();
      });
    return () => { annule = true; };
  }, [ready, session, entrepriseInfo]);

  async function handleLogin(loginData) {
    setSession(loginData);
    try { localStorage.setItem("fatfat_session", JSON.stringify(loginData)); } catch (e) {}

    // Un admin n'a pas d'entreprise (entreprise_id NULL) — /entreprises/moi n'a aucun sens pour lui.
    if (loginData.utilisateur.role === "admin") {
      setEntrepriseInfo(null);
      try { localStorage.removeItem("fatfat_entreprise_info"); } catch (e) {}
      return;
    }

    const entreprise = await apiCall(API_BASE_URL, "/entreprises/moi", { token: loginData.token });
    setEntrepriseInfo(entreprise);
    try { localStorage.setItem("fatfat_entreprise_info", JSON.stringify(entreprise)); } catch (e) {}
  }

  function handleLogout() {
    setSession(null);
    setEntrepriseInfo(null);
    try {
      localStorage.removeItem("fatfat_session");
      localStorage.removeItem("fatfat_entreprise_info");
    } catch (e) {}
  }

  if (!ready) return null;

  if (!API_BASE_URL) {
    // Erreur de configuration côté déploiement, pas un problème pour l'utilisateur final —
    // message technique volontairement sobre, à corriger dans .env.local / les variables
    // d'environnement du serveur d'hébergement, pas par l'utilisateur de l'app.
    return (
      <div className="app">
        <div className="auth-error" style={{ margin: 40 }}>
          Configuration manquante : NEXT_PUBLIC_API_BASE_URL n'est pas définie.
        </div>
      </div>
    );
  }

  const isAdmin = session?.utilisateur.role === "admin";

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="mark">FatFat-App</span>
          <span className="sub">Sénégal</span>
        </div>
        {session && (isAdmin || entrepriseInfo) && (
          <SessionBar session={session} entrepriseInfo={entrepriseInfo} api={api} onLogout={handleLogout} />
        )}
      </div>

      {!session && <LoginScreen apiBaseUrl={API_BASE_URL} onLogin={handleLogin} />}

      {session && isAdmin && <AdminView api={api} />}

      {session && !isAdmin && !entrepriseInfo && (
        <div className="loading-note">Chargement de votre espace...</div>
      )}

      {session && !isAdmin && entrepriseInfo && (
        session.utilisateur.role === "gestionnaire" ? (
          <GestionnaireView api={api} entrepriseInfo={entrepriseInfo} />
        ) : (
          <LivreurView api={api} session={session} entrepriseInfo={entrepriseInfo} />
        )
      )}
    </div>
  );
}
