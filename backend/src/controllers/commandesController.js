const pool = require("../config/db");

const SELECT_COMMANDE = `
  SELECT id, nom_client, telephone_client, repere, statut, date_livraison,
         ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
  FROM commandes
`;

/**
 * GET /api/commandes?date=YYYY-MM-DD  (gestionnaire)
 * Toujours filtré par entreprise_id = req.user.entreprise_id — jamais par un
 * paramètre client. Deux entreprises de la même ville ne voient jamais les mêmes
 * commandes. `date` par défaut = aujourd'hui ("les commandes du jour" du cahier des charges).
 */
async function lister(req, res, next) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const { rows } = await pool.query(
      `${SELECT_COMMANDE} WHERE entreprise_id = $1 AND date_livraison = $2 ORDER BY created_at ASC`,
      [req.user.entreprise_id, date]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/commandes  (gestionnaire)
 * body: { nom_client, telephone_client, repere, lat, lng, date_livraison? }
 * entreprise_id et cree_par viennent du token, jamais du body.
 */
async function creer(req, res, next) {
  try {
    const { nom_client, telephone_client, repere, lat, lng, date_livraison } = req.body;

    if (!nom_client || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "nom_client, lat et lng sont requis." });
    }

    const { rows } = await pool.query(
      `INSERT INTO commandes (nom_client, telephone_client, repere, geom, entreprise_id, cree_par, date_livraison)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, COALESCE($8, CURRENT_DATE))
       RETURNING id, nom_client, telephone_client, repere, statut, date_livraison,
                 ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng`,
      [nom_client, telephone_client || null, repere || null, lng, lat, req.user.entreprise_id, req.user.id, date_livraison || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/commandes/:id  (gestionnaire)
 * La clause `AND entreprise_id = $x` empêche de modifier une commande d'une autre
 * entreprise, même si l'id est deviné/forcé dans l'URL — y compris une entreprise
 * concurrente de la même ville.
 */
async function modifier(req, res, next) {
  try {
    const { nom_client, telephone_client, repere, lat, lng } = req.body;

    const { rows } = await pool.query(
      `UPDATE commandes SET
         nom_client = COALESCE($1, nom_client),
         telephone_client = COALESCE($2, telephone_client),
         repere = COALESCE($3, repere),
         geom = CASE WHEN $4::double precision IS NOT NULL AND $5::double precision IS NOT NULL
                     THEN ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography
                     ELSE geom END
       WHERE id = $6 AND entreprise_id = $7
       RETURNING id, nom_client, telephone_client, repere, statut, date_livraison,
                 ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng`,
      [nom_client || null, telephone_client || null, repere || null, lat ?? null, lng ?? null, req.params.id, req.user.entreprise_id]
    );

    if (!rows[0]) return res.status(404).json({ error: "Commande introuvable pour votre entreprise." });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/commandes/:id  (gestionnaire)
 */
async function supprimer(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM commandes WHERE id = $1 AND entreprise_id = $2`,
      [req.params.id, req.user.entreprise_id]
    );
    if (!rowCount) return res.status(404).json({ error: "Commande introuvable pour votre entreprise." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/commandes/:id/statut  (livreur)
 * body: { statut: 'encours' | 'livre' | 'echec' }
 * Un livreur ne peut changer que le statut d'une commande qui fait partie
 * d'une tournée qui lui est assignée aujourd'hui, dans sa propre entreprise.
 */
async function changerStatut(req, res, next) {
  try {
    const { statut } = req.body;
    const statutsValides = ["attente", "encours", "livre", "echec"];
    if (!statutsValides.includes(statut)) {
      return res.status(400).json({ error: `Statut invalide. Valeurs possibles : ${statutsValides.join(", ")}` });
    }

    const autorisation = await pool.query(
      `SELECT 1 FROM tournees
       WHERE livreur_id = $1 AND entreprise_id = $2
         AND etapes_ordonnees @> to_jsonb($3::int)`,
      [req.user.id, req.user.entreprise_id, Number(req.params.id)]
    );
    if (!autorisation.rows.length) {
      return res.status(403).json({ error: "Cette commande ne fait pas partie de votre tournée." });
    }

    const { rows } = await pool.query(
      `UPDATE commandes SET statut = $1 WHERE id = $2 AND entreprise_id = $3
       RETURNING id, nom_client, statut`,
      [statut, req.params.id, req.user.entreprise_id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { lister, creer, modifier, supprimer, changerStatut };
