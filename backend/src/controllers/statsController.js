const pool = require("../config/db");

/**
 * GET /api/stats?date=YYYY-MM-DD  (gestionnaire)
 * Chiffres clés du jour pour l'entreprise du gestionnaire : volume de commandes,
 * taux de livraison, échecs, distance totale parcourue par les tournées assignées.
 */
async function statsDuJour(req, res, next) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const commandesRes = await pool.query(
      `SELECT statut, COUNT(*) AS n
       FROM commandes
       WHERE entreprise_id = $1 AND date_livraison = $2
       GROUP BY statut`,
      [req.user.entreprise_id, date]
    );

    const parStatut = { attente: 0, encours: 0, livre: 0, echec: 0 };
    let total = 0;
    for (const row of commandesRes.rows) {
      parStatut[row.statut] = Number(row.n);
      total += Number(row.n);
    }

    const tourneesRes = await pool.query(
      `SELECT COUNT(*) AS nb_tournees, COALESCE(SUM(distance_km), 0) AS distance_totale
       FROM tournees
       WHERE entreprise_id = $1 AND date_creation = $2`,
      [req.user.entreprise_id, date]
    );

    const tauxLivraison = total > 0 ? Math.round((parStatut.livre / total) * 100) : 0;

    res.json({
      date,
      total_commandes: total,
      par_statut: parStatut,
      taux_livraison_pct: tauxLivraison,
      nb_tournees: Number(tourneesRes.rows[0].nb_tournees),
      distance_totale_km: Number(tourneesRes.rows[0].distance_totale),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { statsDuJour };
