const bcrypt = require("bcryptjs");
const pool = require("../config/db");

/**
 * GET /api/admin/villes  (admin)
 * Liste les villes disponibles — nécessaire pour choisir la ville d'une nouvelle
 * entreprise. Contrairement au reste de l'API, cette route n'a rien de sensible :
 * les noms de ville ne sont pas une donnée confidentielle, seules les entreprises
 * et leurs commandes le sont.
 */
async function listerVilles(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, nom, centre_latitude, centre_longitude, zoom_defaut FROM villes ORDER BY nom ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/entreprises  (admin)
 * Liste TOUTES les entreprises clientes, tous rôles confondus — c'est la seule route
 * de toute l'API qui voit au-delà d'une seule entreprise, réservée à l'exploitant.
 * Ne renvoie aucune commande ni tournée : juste l'identité et le statut de chaque entreprise.
 */
async function listerEntreprises(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.nom, e.hub_nom, e.actif, e.created_at, v.nom AS ville_nom,
              (SELECT COUNT(*) FROM utilisateurs u WHERE u.entreprise_id = e.id AND u.role = 'gestionnaire') AS nb_gestionnaires,
              (SELECT COUNT(*) FROM utilisateurs u WHERE u.entreprise_id = e.id AND u.role = 'livreur') AS nb_livreurs
       FROM entreprises e
       JOIN villes v ON v.id = e.ville_id
       ORDER BY e.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/entreprises  (admin)
 * body: { nom, ville_id, hub_nom, hub_lat, hub_lng, gestionnaire: { nom, telephone, mot_de_passe } }
 * Crée l'entreprise ET son premier compte gestionnaire dans la même transaction —
 * une entreprise sans aucun gestionnaire ne serait accessible à personne.
 */
async function creerEntreprise(req, res, next) {
  const client = await pool.connect();
  try {
    const { nom, ville_id, hub_nom, hub_lat, hub_lng, gestionnaire } = req.body;

    if (!nom || !ville_id || !hub_nom || hub_lat === undefined || hub_lng === undefined || !gestionnaire) {
      return res.status(400).json({ error: "nom, ville_id, hub_nom, hub_lat, hub_lng et gestionnaire sont requis." });
    }
    if (!gestionnaire.nom || !gestionnaire.telephone || !gestionnaire.mot_de_passe) {
      return res.status(400).json({ error: "gestionnaire.nom, gestionnaire.telephone et gestionnaire.mot_de_passe sont requis." });
    }

    const existant = await client.query(`SELECT id FROM utilisateurs WHERE telephone = $1`, [gestionnaire.telephone]);
    if (existant.rows.length) {
      return res.status(409).json({ error: "Ce numéro de téléphone est déjà utilisé par un autre compte." });
    }

    await client.query("BEGIN");

    const entrepriseRes = await client.query(
      `INSERT INTO entreprises (nom, ville_id, hub_nom, hub_geom)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography)
       RETURNING id, nom`,
      [nom, ville_id, hub_nom, hub_lng, hub_lat]
    );
    const entreprise = entrepriseRes.rows[0];

    const hash = await bcrypt.hash(gestionnaire.mot_de_passe, 10);
    const gestionnaireRes = await client.query(
      `INSERT INTO utilisateurs (nom, telephone, mot_de_passe_hash, role, entreprise_id)
       VALUES ($1, $2, $3, 'gestionnaire', $4)
       RETURNING id, nom, telephone`,
      [gestionnaire.nom, gestionnaire.telephone, hash, entreprise.id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      entreprise,
      gestionnaire: gestionnaireRes.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

/**
 * PATCH /api/admin/entreprises/:id/statut  (admin)
 * body: { actif: true|false }
 * Désactive une entreprise (impayé, résiliation...) sans supprimer ses données —
 * ses gestionnaires et livreurs ne pourront plus se connecter tant qu'elle est inactive.
 * (Le blocage effectif à la connexion est géré par authController : il vérifie déjà
 * `actif` sur l'utilisateur ; une future amélioration pourrait aussi vérifier
 * `entreprises.actif`, documenté dans le README comme limite connue.)
 */
async function activerDesactiverEntreprise(req, res, next) {
  try {
    const { actif } = req.body;
    const { rows } = await pool.query(
      `UPDATE entreprises SET actif = $1 WHERE id = $2 RETURNING id, nom, actif`,
      [actif, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Entreprise introuvable." });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { listerVilles, listerEntreprises, creerEntreprise, activerDesactiverEntreprise };
