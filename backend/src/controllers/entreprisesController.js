const pool = require("../config/db");

/**
 * GET /api/entreprises/moi
 * Volontairement PAS de route qui listerait toutes les entreprises : un utilisateur
 * cloisonné n'a aucune raison de voir les entreprises concurrentes, même juste leurs noms.
 * Renvoie uniquement les infos de SA propre entreprise (hub pour la carte, nom pour
 * l'affichage) — filtré par entreprise_id du token, jamais par un paramètre client.
 */
async function monEntreprise(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.nom, e.hub_nom,
              ST_Y(e.hub_geom::geometry) AS hub_lat,
              ST_X(e.hub_geom::geometry) AS hub_lng,
              v.nom AS ville_nom, v.centre_latitude, v.centre_longitude, v.zoom_defaut
       FROM entreprises e
       JOIN villes v ON v.id = e.ville_id
       WHERE e.id = $1`,
      [req.user.entreprise_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Entreprise introuvable." });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { monEntreprise };
