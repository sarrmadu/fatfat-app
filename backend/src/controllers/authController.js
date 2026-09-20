const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { signToken } = require("../middleware/auth");

/**
 * POST /api/auth/login
 * body: { telephone, mot_de_passe }
 * Ne renvoie jamais l'entreprise_id à choisir par le client : il est lu en base
 * puis embarqué dans le token, une fois pour toutes, à la connexion.
 */
async function login(req, res, next) {
  try {
    const { telephone, mot_de_passe } = req.body;
    if (!telephone || !mot_de_passe) {
      return res.status(400).json({ error: "Téléphone et mot de passe requis." });
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.nom, u.role, u.mot_de_passe_hash, u.actif,
              u.entreprise_id, e.nom AS entreprise_nom, e.actif AS entreprise_actif,
              e.ville_id, v.nom AS ville_nom
       FROM utilisateurs u
       LEFT JOIN entreprises e ON e.id = u.entreprise_id
       LEFT JOIN villes v ON v.id = e.ville_id
       WHERE u.telephone = $1`,
      [telephone]
    );

    const utilisateur = rows[0];
    if (!utilisateur || !utilisateur.actif) {
      return res.status(401).json({ error: "Identifiants invalides." });
    }
    // Un gestionnaire/livreur dont l'entreprise a été désactivée (impayé, résiliation...)
    // ne peut plus se connecter, même avec le bon mot de passe. Sans effet sur un admin
    // (entreprise_actif est NULL pour lui, la condition est ignorée).
    if (utilisateur.role !== "admin" && utilisateur.entreprise_actif === false) {
      return res.status(401).json({ error: "Ce compte est rattaché à une entreprise désactivée." });
    }

    const motDePasseValide = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe_hash);
    if (!motDePasseValide) {
      return res.status(401).json({ error: "Identifiants invalides." });
    }

    const token = signToken(utilisateur);
    res.json({
      token,
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        role: utilisateur.role,
        entreprise_id: utilisateur.entreprise_id,
        entreprise_nom: utilisateur.entreprise_nom,
        ville_nom: utilisateur.ville_nom,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/auth/mot-de-passe  (tout utilisateur connecté)
 * body: { ancien_mot_de_passe, nouveau_mot_de_passe }
 * Volontairement PAS de "mot de passe oublié" par SMS/email dans cette version :
 * ça demanderait une passerelle SMS (Twilio/Orange...) qui dépasse le cadre du prototype.
 * En attendant, un gestionnaire peut réinitialiser le mot de passe d'un livreur de son
 * entreprise via PATCH /api/utilisateurs/:id/reinitialiser-mot-de-passe (voir utilisateursController).
 */
async function changerMotDePasse(req, res, next) {
  try {
    const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;

    const { rows } = await pool.query(
      `SELECT mot_de_passe_hash FROM utilisateurs WHERE id = $1`,
      [req.user.id]
    );
    const utilisateur = rows[0];
    if (!utilisateur) return res.status(404).json({ error: "Utilisateur introuvable." });

    const valide = await bcrypt.compare(ancien_mot_de_passe, utilisateur.mot_de_passe_hash);
    if (!valide) return res.status(401).json({ error: "Ancien mot de passe incorrect." });

    const nouveauHash = await bcrypt.hash(nouveau_mot_de_passe, 10);
    await pool.query(`UPDATE utilisateurs SET mot_de_passe_hash = $1 WHERE id = $2`, [nouveauHash, req.user.id]);

    res.json({ message: "Mot de passe mis à jour." });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, changerMotDePasse };
