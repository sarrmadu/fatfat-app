"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Ticket from "./Ticket";
import PositionPicker from "./PositionPicker";

const CACHE_KEY = "fatfat_tournee_cache";
const QUEUE_KEY = "fatfat_pending_actions";

export default function LivreurView({ api, session, entrepriseInfo }) {
  const [tournee, setTournee] = useState(null);
  const [error, setError] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [reoptStatus, setReoptStatus] = useState(null); // {type, message}
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState([]);
  const tourneeRef = useRef(null); // pour lire l'état courant dans les callbacks réseau

  useEffect(() => { tourneeRef.current = tournee; }, [tournee]);

  // Restaure le cache local (survit à un rechargement de page — contrairement au fichier
  // HTML autonome exécuté dans l'aperçu Claude, ceci est un vrai projet Next.js dans le
  // navigateur, où localStorage fonctionne normalement).
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const queue = localStorage.getItem(QUEUE_KEY);
      if (cached) setTournee(JSON.parse(cached));
      if (queue) setPendingActions(JSON.parse(queue));
    } catch (e) {}
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
  }, []);

  const chargerTournee = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return; // le cache déjà affiché suffit
    try {
      const data = await api("/tournees/mine");
      setTournee(data);
      setError(null);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
    } catch (err) {
      if (!tourneeRef.current) setError(err.message);
      // sinon on garde silencieusement la version en cache déjà affichée
    }
  }, [api]);

  useEffect(() => { chargerTournee(); }, [chargerTournee]);

  const flushPendingActions = useCallback(async () => {
    setPendingActions((current) => {
      if (!current.length) return current;
      (async () => {
        const queue = [...current];
        const restantes = [];
        for (const action of queue) {
          try {
            if (action.type === "statut") {
              await api(`/commandes/${action.commandeId}/statut`, { method: "PATCH", body: { statut: action.statut } });
            }
          } catch (err) {
            restantes.push(action);
          }
        }
        setPendingActions(restantes);
        try { localStorage.setItem(QUEUE_KEY, JSON.stringify(restantes)); } catch (e) {}
        chargerTournee();
      })();
      return current;
    });
  }, [api, chargerTournee]);

  useEffect(() => {
    function handleOnline() { setIsOnline(true); flushPendingActions(); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushPendingActions]);

  async function handleStatusChange(commandeId, statut) {
    // Mise à jour optimiste locale, fonctionne même hors-ligne.
    setTournee((prev) => {
      if (!prev) return prev;
      const next = { ...prev, etapes: prev.etapes.map((e) => (e.id === commandeId ? { ...e, statut } : e)) };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });

    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    if (offline) {
      queueAction({ type: "statut", commandeId, statut });
      return;
    }
    try {
      await api(`/commandes/${commandeId}/statut`, { method: "PATCH", body: { statut } });
      await chargerTournee();
    } catch (err) {
      queueAction({ type: "statut", commandeId, statut });
    }
  }

  function queueAction(action) {
    setPendingActions((current) => {
      const next = [...current, action];
      try { localStorage.setItem(QUEUE_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  }

  async function reoptimiser(here) {
    if (!tournee) return;
    try {
      const result = await api(`/tournees/${tournee.id}/reoptimiser`, { method: "POST", body: here });
      setTournee(result.id ? { ...tournee, ...result } : { ...tournee, etapes: result.etapes, distance_km: result.distance_km });
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...tournee, etapes: result.etapes, distance_km: result.distance_km })); } catch (e) {}
      setReoptStatus({ type: "success", message: `Recalculé · ${result.distance_km} km restants` });
      setShowPicker(false);
    } catch (err) {
      setReoptStatus({ type: "error", message: err.message });
    }
  }

  function lancerReoptimisation() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setReoptStatus({ type: "error", message: "Réoptimisation indisponible hors-ligne — nécessite une connexion au serveur." });
      return;
    }
    if (!navigator.geolocation) {
      setReoptStatus({ type: "error", message: "Géolocalisation indisponible — indiquez votre position sur la carte." });
      setShowPicker(true);
      return;
    }
    setReoptStatus({ type: "pending", message: "Localisation en cours..." });
    navigator.geolocation.getCurrentPosition(
      (pos) => reoptimiser({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setReoptStatus({ type: "error", message: "Géolocalisation bloquée ici — indiquez votre position sur la carte." });
        setShowPicker(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  if (error && !tournee) {
    return <div className="driver-wrap"><div className="auth-error">{error}</div></div>;
  }

  if (!tournee) {
    return (
      <div className="driver-wrap">
        <div className="empty-state" style={{ background: "var(--panel)", borderRadius: 14, border: "1px solid var(--line)" }}>
          Aucune tournée assignée pour l'instant à {session.utilisateur.nom}.<br />
          Le gestionnaire de {session.utilisateur.entreprise_nom} doit d'abord optimiser puis assigner une tournée.
        </div>
      </div>
    );
  }

  const stops = tournee.etapes;
  const done = stops.filter((c) => c.statut === "livre").length;
  const pct = Math.round((done / stops.length) * 100);
  const remaining = stops.filter((c) => c.statut !== "livre").length;

  return (
    <div className="driver-wrap">
      {(!isOnline || pendingActions.length > 0) && (
        <div className="offline-banner">
          {!isOnline
            ? "Hors-ligne — les actions seront synchronisées au retour du réseau."
            : `${pendingActions.length} action(s) en attente de synchronisation...`}
        </div>
      )}

      <div className="progress-card">
        <div className="label">Tournée du jour · {session.utilisateur.entreprise_nom}</div>
        <div className="count">{done} / {stops.length} livrées</div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="reopt-box">
        <button className="btn btn-primary" disabled={remaining < 2} onClick={lancerReoptimisation}>
          Réoptimiser depuis ma position
        </button>
        {reoptStatus && <div className={`reopt-status ${reoptStatus.type === "pending" ? "" : reoptStatus.type}`}>{reoptStatus.message}</div>}
        {showPicker && <PositionPicker entrepriseInfo={entrepriseInfo} onConfirm={reoptimiser} />}
      </div>

      {stops.map((etape, i) => (
        <Ticket key={etape.id} etape={etape} num={i + 1} onStatusChange={handleStatusChange} />
      ))}
    </div>
  );
}
