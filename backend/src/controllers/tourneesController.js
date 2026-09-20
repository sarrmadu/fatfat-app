const pool = require("../config/db");
const { optimiserTournee } = require("../services/optimizer");

async function getHubDeLEntreprise(entrepriseId) {
  const { rows } = await pool.query(
    `SELECT ST_Y(hub_geom::geometry) AS lat, ST_X(hub_geom::geometry) AS lng, hub_nom
     FROM entreprises WHERE id = $1`,
    [entrepriseId]
  );
  return rows[0];
}

async function getCommandesParIds(entrepriseId, ids) {
  const { rows } = await pool.query(
    `SELECT id, nom_client, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
     FROM commandes WHERE entreprise_id = $1 AND id = ANY($2::int[])`,
    [entrepriseId, ids]
  );
  return rows;
}

/**
 * POST /api/tournees/optimiser  (gestionnaire)
 * body: { commande_ids: [12, 7, 15, ...] }
 * Calcule un ordre optimisé depuis le hub de l'entreprise, SANS rien enregistrer —
 * c'est un aperçu que le gestionnaire peut accepter (POST /api/tournees) ou ignorer.
 */
async function previsualiser(req, res, next) {
  try {
    const { commande_ids } = req.body;
    if (!Array.isArray(commande_ids) || commande_ids.length < 2) {
      return res.status(400).json({ error: "Fournissez au moins 2 commande_ids." });
    }

    const hub = await getHubDeLEntreprise(req.user.entreprise_id);
    const commandes = await getCommandesParIds(req.user.entreprise_id, commande_ids);

    if (commandes.length !== commande_ids.length) {
      return res.status(400).json({ error: "Certaines commandes n'existent pas dans votre entreprise." });
    }

    const { ordre, distanceKm } = optimiserTournee(hub, commandes);
    res.json({
      hub,
      distance_km: distanceKm,
      etapes: ordre.map((c, i) => ({ ordre: i + 1, commande_id: c.id, nom_client: c.nom_client, lat: c.lat, lng: c.lng })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tournees  (gestionnaire)
 * body: { livreur_id, commande_ids (déjà ordonnés), distance_km? }
 * Persiste la tournée. Vérifie que le livreur appartient bien à la même entreprise
 * (impossible d'assigner à un livreur d'une entreprise concurrente, même en forçant l'id,
 * même si cette entreprise concurrente est dans la même ville).
 */
async function assigner(req, res, next) {
  try {
    const { livreur_id, commande_ids, distance_km } = req.body;
    if (!livreur_id || !Array.isArray(commande_ids) || !commande_ids.length) {
      return res.status(400).json({ error: "livreur_id et commande_ids sont requis." });
    }

    const livreur = await pool.query(
      `SELECT id, capacite_max FROM utilisateurs WHERE id = $1 AND entreprise_id = $2 AND role = 'livreur' AND actif = TRUE`,
      [livreur_id, req.user.entreprise_id]
    );
    if (!livreur.rows.length) {
      return res.status(400).json({ error: "Livreur introuvable dans votre entreprise." });
    }

    const capacite = livreur.rows[0].capacite_max;
    if (capacite !== null && commande_ids.length > capacite) {
      return res.status(400).json({
        error: `Ce livreur a une capacité maximale de ${capacite} colis (${commande_ids.length} demandés). Répartissez sur plusieurs livreurs.`,
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO tournees (livreur_id, entreprise_id, etapes_ordonnees, distance_km, cree_par)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING id, livreur_id, date_creation, etapes_ordonnees, distance_km`,
      [livreur_id, req.user.entreprise_id, JSON.stringify(commande_ids), distance_km || null, req.user.id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournees/mine  (livreur)
 * Renvoie la tournée du jour assignée au livreur connecté, avec le détail des commandes
 * dans l'ordre calculé.
 */
async function maTournee(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await pool.query(
      `SELECT id, etapes_ordonnees, distance_km, date_creation
       FROM tournees
       WHERE livreur_id = $1 AND entreprise_id = $2 AND date_creation = $3
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id, req.user.entreprise_id, today]
    );

    const tournee = rows[0];
    if (!tournee) return res.json(null);

    const ids = tournee.etapes_ordonnees;
    const commandes = await getCommandesDetailleesParIds(req.user.entreprise_id, ids);
    const parId = Object.fromEntries(commandes.map((c) => [c.id, c]));

    res.json({
      id: tournee.id,
      distance_km: tournee.distance_km,
      date_creation: tournee.date_creation,
      etapes: ids.map((id, i) => ({ ordre: i + 1, ...parId[id] })),
    });
  } catch (err) {
    next(err);
  }
}

async function getCommandesDetailleesParIds(entrepriseId, ids) {
  const { rows } = await pool.query(
    `SELECT id, nom_client, telephone_client, repere, statut,
            ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
     FROM commandes WHERE entreprise_id = $1 AND id = ANY($2::int[])`,
    [entrepriseId, ids]
  );
  return rows;
}

/**
 * POST /api/tournees/:id/reoptimiser  (livreur)
 * body: { lat, lng }  — position actuelle du livreur (GPS ou pointage manuel de secours)
 * Ne réordonne que les commandes pas encore livrées ; celles déjà livrées gardent
 * leur place en tête de liste.
 */
async function reoptimiser(req, res, next) {
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "lat et lng sont requis." });
    }

    const tourneeRes = await pool.query(
      `SELECT id, etapes_ordonnees FROM tournees WHERE id = $1 AND livreur_id = $2 AND entreprise_id = $3`,
      [req.params.id, req.user.id, req.user.entreprise_id]
    );
    const tournee = tourneeRes.rows[0];
    if (!tournee) return res.status(404).json({ error: "Tournée introuvable." });

    const commandes = await getCommandesDetailleesParIds(req.user.entreprise_id, tournee.etapes_ordonnees);
    const parId = Object.fromEntries(commandes.map((c) => [c.id, c]));

    const dejaLivrees = tournee.etapes_ordonnees.filter((id) => parId[id]?.statut === "livre");
    const restantes = tournee.etapes_ordonnees
      .filter((id) => parId[id]?.statut !== "livre")
      .map((id) => parId[id]);

    const { ordre, distanceKm } = optimiserTournee({ lat, lng }, restantes);
    const nouvelOrdre = [...dejaLivrees, ...ordre.map((c) => c.id)];

    const { rows } = await pool.query(
      `UPDATE tournees SET etapes_ordonnees = $1::jsonb, distance_km = $2
       WHERE id = $3 RETURNING id, etapes_ordonnees, distance_km`,
      [JSON.stringify(nouvelOrdre), distanceKm, tournee.id]
    );

    res.json({
      id: rows[0].id,
      distance_km: distanceKm,
      etapes: nouvelOrdre.map((id, i) => ({ ordre: i + 1, ...parId[id] })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tournees/historique?depuis=YYYY-MM-DD&jusqu_a=YYYY-MM-DD  (gestionnaire)
 * Historique des tournées passées de l'entreprise, avec le nom du livreur et le nombre
 * d'arrêts. Par défaut : les 30 derniers jours.
 */
async function historique(req, res, next) {
  try {
    const jusquA = req.query.jusqu_a || new Date().toISOString().slice(0, 10);
    const depuisDefaut = new Date();
    depuisDefaut.setDate(depuisDefaut.getDate() - 30);
    const depuis = req.query.depuis || depuisDefaut.toISOString().slice(0, 10);

    const { rows } = await pool.query(
      `SELECT t.id, t.date_creation, t.distance_km, u.nom AS livreur_nom,
              jsonb_array_length(t.etapes_ordonnees) AS nb_arrets
       FROM tournees t
       JOIN utilisateurs u ON u.id = t.livreur_id
       WHERE t.entreprise_id = $1 AND t.date_creation BETWEEN $2 AND $3
       ORDER BY t.date_creation DESC, t.created_at DESC`,
      [req.user.entreprise_id, depuis, jusquA]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { previsualiser, assigner, maTournee, reoptimiser, historique, suiviDuJour };

/**
 * GET /api/tournees/suivi  (gestionnaire)
 * Vue en direct des tournées assignées AUJOURD'HUI dans l'entreprise : combien
 * d'arrêts, combien déjà livrés, et un statut "terminee" dès que plus aucune étape
 * n'est en attente ou en cours (le gestionnaire sait alors que le livreur a fini,
 * sans qu'il ait besoin de l'appeler).
 * Le frontend interroge cette route à intervalles réguliers (voir StatsTab/TourneeTab) —
 * pas de WebSocket dans cette version, volontairement, pour rester simple à héberger.
 */
async function suiviDuJour(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await pool.query(
      `SELECT t.id, t.etapes_ordonnees, t.distance_km, u.nom AS livreur_nom
       FROM tournees t
       JOIN utilisateurs u ON u.id = t.livreur_id
       WHERE t.entreprise_id = $1 AND t.date_creation = $2
       ORDER BY t.created_at DESC`,
      [req.user.entreprise_id, today]
    );

    const resultats = [];
    for (const t of rows) {
      const commandes = await getCommandesDetailleesParIds(req.user.entreprise_id, t.etapes_ordonnees);
      const parId = Object.fromEntries(commandes.map((c) => [c.id, c]));
      const statuts = t.etapes_ordonnees.map((id) => parId[id]?.statut);
      const nbLivrees = statuts.filter((s) => s === "livre").length;
      const nbEchecs = statuts.filter((s) => s === "echec").length;
      const enAttente = statuts.some((s) => s === "attente" || s === "encours");

      resultats.push({
        id: t.id,
        livreur_nom: t.livreur_nom,
        distance_km: t.distance_km,
        nb_arrets: t.etapes_ordonnees.length,
        nb_livrees: nbLivrees,
        nb_echecs: nbEchecs,
        statut: enAttente ? "en_cours" : "terminee",
      });
    }

    res.json(resultats);
  } catch (err) {
    next(err);
  }
}
