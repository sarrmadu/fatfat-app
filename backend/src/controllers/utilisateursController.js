const bcrypt = require("bcryptjs");
const pool = require("../config/db");

/**
 * GET /api/utilisateurs/livreurs  (gestionnaire)
 * Liste TOUS les livreurs de l'entreprise (actifs et désactivés) — utile pour l'écran
 * de gestion. Pour le menu d'assignation d'une tournée, le frontend filtre lui-même
 * sur `actif`.
 */
async function listerLivreurs(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, nom, telephone, actif, capacite_max, created_at
       FROM utilisateurs
       WHERE entreprise_id = $1 AND role = 'livreur'
       ORDER BY actif DESC, nom ASC`,
      [req.user.entreprise_id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/utilisateurs/livreurs  (gestionnaire)
 * body: { nom, telephone, mot_de_passe, capacite_max? }
 * Crée un compte livreur DANS LA MÊME ENTREPRISE que le gestionnaire connecté —
 * impossible de créer un compte pour une autre entreprise, entreprise_id vient du token.
 * capacite_max (optionnel) : nombre max de colis que ce livreur peut prendre en
 * une tournée. Laissé vide = illimité.
 */
async function creerLivreur(req, res, next) {
  try {
    const { nom, telephone, mot_de_passe, capacite_max } = req.body;

    const existant = await pool.query(`SELECT id FROM utilisateurs WHERE telephone = $1`, [telephone]);
    if (existant.rows.length) {
      return res.status(409).json({ error: "Ce numéro de téléphone est déjà utilisé." });
    }

    const hash = await bcrypt.hash(mot_de_passe, 10);
    const { rows } = await pool.query(
      `INSERT INTO utilisateurs (nom, telephone, mot_de_passe_hash, role, entreprise_id, capacite_max)
       VALUES ($1, $2, $3, 'livreur', $4, $5)
       RETURNING id, nom, telephone, actif, capacite_max, created_at`,
      [nom, telephone, hash, req.user.entreprise_id, capacite_max || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/utilisateurs/livreurs/:id/statut  (gestionnaire)
 * body: { actif: true|false }
 * Désactiver plutôt que supprimer : on garde l'historique des tournées passées
 * de ce livreur intact (contrainte de clé étrangère).
 */
async function activerDesactiverLivreur(req, res, next) {
  try {
    const { actif } = req.body;
    const { rows } = await pool.query(
      `UPDATE utilisateurs SET actif = $1
       WHERE id = $2 AND entreprise_id = $3 AND role = 'livreur'
       RETURNING id, nom, telephone, actif`,
      [actif, req.params.id, req.user.entreprise_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Livreur introuvable dans votre entreprise." });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/utilisateurs/livreurs/:id/reinitialiser-mot-de-passe  (gestionnaire)
 * body: { nouveau_mot_de_passe }
 * Palliatif pragmatique à l'absence de "mot de passe oublié" par SMS : le gestionnaire,
 * qui connaît physiquement ses livreurs, peut leur définir un nouveau mot de passe.
 */
async function reinitialiserMotDePasse(req, res, next) {
  try {
    const { nouveau_mot_de_passe } = req.body;
    const hash = await bcrypt.hash(nouveau_mot_de_passe, 10);

    const { rows } = await pool.query(
      `UPDATE utilisateurs SET mot_de_passe_hash = $1
       WHERE id = $2 AND entreprise_id = $3 AND role = 'livreur'
       RETURNING id, nom`,
      [hash, req.params.id, req.user.entreprise_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Livreur introuvable dans votre entreprise." });
    res.json({ message: `Mot de passe réinitialisé pour ${rows[0].nom}.` });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/utilisateurs/livreurs/:id/telephone  (gestionnaire)
 * body: { nouveau_telephone }
 * Couvre le cas bloquant que la fonction en libre-service (PATCH /api/auth/telephone)
 * ne couvre pas : un livreur qui perd son téléphone (numéro ET accès en même temps)
 * ne peut plus se reconnecter pour changer lui-même son numéro. Le gestionnaire, qui
 * le connaît physiquement, peut le faire à sa place — même logique que la
 * réinitialisation de mot de passe ci-dessus.
 */
async function modifierTelephoneLivreur(req, res, next) {
  try {
    const { nouveau_telephone } = req.body;

    const existant = await pool.query(
      `SELECT id FROM utilisateurs WHERE telephone = $1 AND id != $2`,
      [nouveau_telephone, req.params.id]
    );
    if (existant.rows.length) {
      return res.status(409).json({ error: "Ce numéro de téléphone est déjà utilisé par un autre compte." });
    }

    const { rows } = await pool.query(
      `UPDATE utilisateurs SET telephone = $1
       WHERE id = $2 AND entreprise_id = $3 AND role = 'livreur'
       RETURNING id, nom, telephone`,
      [nouveau_telephone, req.params.id, req.user.entreprise_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Livreur introuvable dans votre entreprise." });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { listerLivreurs, creerLivreur, activerDesactiverLivreur, reinitialiserMotDePasse, modifierTelephoneLivreur };
