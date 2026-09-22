"use client";

import { useState } from "react";
import { apiCall } from "../lib/api";
import { DEMO_ACCOUNTS, SEED_PASSWORD } from "../lib/constants";

const AFFICHER_COMPTES_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";

export default function LoginScreen({ apiBaseUrl, onLogin }) {
  const [telephone, setTelephone] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [connectingTel, setConnectingTel] = useState(null);

  const villes = [...new Set(DEMO_ACCOUNTS.map((u) => u.ville))];

  async function connecter(tel, pass) {
    setError(null);
    try {
      const data = await apiCall(apiBaseUrl, "/auth/login", {
        method: "POST",
        body: { telephone: tel, mot_de_passe: pass },
      });
      await onLogin(data);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await connecter(telephone.trim(), motDePasse);
    } catch (err) {
      /* déjà affiché via setError */
    } finally {
      setLoading(false);
    }
  }

  async function seConnecterDemo(tel) {
    setConnectingTel(tel);
    try {
      await connecter(tel, SEED_PASSWORD);
    } catch (err) {
      /* déjà affiché via setError */
    } finally {
      setConnectingTel(null);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-head">
        <div className="mark">FatFat</div>
        <p>Connectez-vous à votre compte.</p>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form className="real-login-form" onSubmit={handleSubmit}>
        <label htmlFor="loginTel">Téléphone</label>
        <input
          id="loginTel"
          type="tel"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="77 000 00 00"
          required
        />
        <label htmlFor="loginPass">Mot de passe</label>
        <input
          id="loginPass"
          type="password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          placeholder="••••••••"
          required
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      {AFFICHER_COMPTES_DEMO && (
        <div style={{ textAlign: "center", margin: "16px 0" }}>
          <button className="link-subtle" onClick={() => setShowDemo((v) => !v)}>
            {showDemo ? "Masquer les comptes de démonstration" : "Voir les comptes de démonstration"}
          </button>
        </div>
      )}

      {AFFICHER_COMPTES_DEMO && showDemo && (
        <div className="demo-accounts-box">
          <div className="login-note">
            Ces boutons se connectent avec le mot de passe de seed (<code>{SEED_PASSWORD}</code>) —
            utile pour tester rapidement, pas pour un vrai compte client.
          </div>
          {villes.map((ville) => {
            const entreprisesDeCetteVille = [
              ...new Set(DEMO_ACCOUNTS.filter((u) => u.ville === ville).map((u) => u.entreprise)),
            ];
            return (
              <div className="city-group" key={ville}>
                <div className="city-group-title">{ville}</div>
                {entreprisesDeCetteVille.map((entreprise) => (
                  <div className="entreprise-group" key={entreprise}>
                    <div className="entreprise-group-title">{entreprise}</div>
                    <div className="account-list">
                      {DEMO_ACCOUNTS.filter((u) => u.entreprise === entreprise).map((u) => (
                        <div className="account-row" key={u.telephone}>
                          <div className={`account-avatar ${u.role}`}>
                            {u.nom.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                          </div>
                          <div className="account-info">
                            <div className="account-name">{u.nom}</div>
                            <div className="account-role">
                              {u.role === "gestionnaire" ? "Gestionnaire" : "Livreur"}
                            </div>
                          </div>
                          <button
                            className="btn-connect"
                            disabled={connectingTel === u.telephone}
                            onClick={() => seConnecterDemo(u.telephone)}
                          >
                            {connectingTel === u.telephone ? "Connexion..." : "Se connecter"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}