// Peuple la base avec des villes, PLUSIEURS entreprises (dont certaines partagent
// la même ville — c'est le scénario réel à vérifier), des comptes de démo et des
// commandes du jour.
// ATTENTION : ce script vide (TRUNCATE) les tables avant de les repeupler — usage démo/dev uniquement.
// Usage : npm run seed

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const SEED_PASSWORD = process.env.SEED_PASSWORD || "demo1234";

const VILLES = [
  { nom: "Dakar", lat: 14.6928, lng: -17.4467, zoom: 12 },
  { nom: "Thiès", lat: 14.7910, lng: -16.9256, zoom: 13 },
  { nom: "Mbour", lat: 14.4230, lng: -16.9600, zoom: 13 },
];

// Six entreprises clientes, réparties sur Dakar et Thiès — deux entreprises
// différentes peuvent partager la même ville, elles ne doivent JAMAIS voir
// les données l'une de l'autre.
const ENTREPRISES = [
  { nom: "Teranga Shop", ville: "Dakar", hub_nom: "Hub Plateau", lat: 14.6937, lng: -17.4441 },
  { nom: "Dakar Express Delivery", ville: "Dakar", hub_nom: "Hub Médina", lat: 14.6789, lng: -17.4412 },
  { nom: "Sunu Colis", ville: "Dakar", hub_nom: "Hub Liberté 6", lat: 14.7135, lng: -17.4602 },
  { nom: "Thiès Rapide", ville: "Thiès", hub_nom: "Hub Randoulène", lat: 14.7912, lng: -16.9256 },
  { nom: "Rail Express Thiès", ville: "Thiès", hub_nom: "Hub Gare", lat: 14.7889, lng: -16.9315 },
  { nom: "Saly Logistique", ville: "Mbour", hub_nom: "Hub Mbour", lat: 14.4230, lng: -16.9600 },
];

// Comptes de démo : 1 gestionnaire + 1-2 livreurs par entreprise.
const UTILISATEURS = [
  { nom: "Fatima Sy",        telephone: "770000001", role: "gestionnaire", entreprise: "Teranga Shop" },
  { nom: "Moussa Diop",      telephone: "770000002", role: "livreur",       entreprise: "Teranga Shop" },
  { nom: "Aïssatou Ndiaye",  telephone: "770000003", role: "livreur",       entreprise: "Teranga Shop" },

  { nom: "Babacar Gueye",    telephone: "770000010", role: "gestionnaire", entreprise: "Dakar Express Delivery" },
  { nom: "Modou Fall",       telephone: "770000011", role: "livreur",       entreprise: "Dakar Express Delivery" },

  { nom: "Astou Mbaye",      telephone: "770000020", role: "gestionnaire", entreprise: "Sunu Colis" },
  { nom: "Ibrahima Sarr",    telephone: "770000021", role: "livreur",       entreprise: "Sunu Colis" },

  { nom: "Ibrahima Ka",      telephone: "770000004", role: "gestionnaire", entreprise: "Thiès Rapide" },
  { nom: "Cheikh Faye",      telephone: "770000005", role: "livreur",       entreprise: "Thiès Rapide" },

  { nom: "Ndeye Coumba Diaw",telephone: "770000030", role: "gestionnaire", entreprise: "Rail Express Thiès" },
  { nom: "Ousmane Ba",       telephone: "770000031", role: "livreur",       entreprise: "Rail Express Thiès" },

  { nom: "Aminata Diouf",    telephone: "770000006", role: "gestionnaire", entreprise: "Saly Logistique" },
  { nom: "Fatou Sarr",       telephone: "770000007", role: "livreur",       entreprise: "Saly Logistique" },
];

// Commandes du jour, réparties par entreprise (donc deux entreprises de Dakar
// ont des commandes DIFFÉRENTES, jamais partagées).
const COMMANDES = [
  // Teranga Shop (Dakar)
  { entreprise: "Teranga Shop", nom_client: "Boutique Sokhna Fall", telephone_client: "775123304", repere: "Face au terrain de foot, portail vert", lat: 14.6845, lng: -17.4530 },
  { entreprise: "Teranga Shop", nom_client: "Cyber Point E", telephone_client: "762339012", repere: "À côté de la station Total", lat: 14.6912, lng: -17.4652 },
  { entreprise: "Teranga Shop", nom_client: "Pharmacie Ouakam", telephone_client: "701458821", repere: "Juste après le rond-point, sur la droite", lat: 14.7194, lng: -17.4839 },
  { entreprise: "Teranga Shop", nom_client: "Villa Ngor", telephone_client: "783021455", repere: "Maison bleue, deux étages", lat: 14.7458, lng: -17.5127 },

  // Dakar Express Delivery (Dakar aussi — entreprise différente, données différentes)
  { entreprise: "Dakar Express Delivery", nom_client: "Atelier Médina", telephone_client: "778902176", repere: "Ruelle derrière la mosquée", lat: 14.6789, lng: -17.4412 },
  { entreprise: "Dakar Express Delivery", nom_client: "Garage Fass", telephone_client: "776541287", repere: "Portail rouge, klaxonner", lat: 14.6820, lng: -17.4470 },
  { entreprise: "Dakar Express Delivery", nom_client: "Boutique Colobane", telephone_client: "775332211", repere: null, lat: 14.6870, lng: -17.4390 },

  // Sunu Colis (Dakar aussi)
  { entreprise: "Sunu Colis", nom_client: "Épicerie Liberté 6", telephone_client: "766017709", repere: null, lat: 14.7135, lng: -17.4602 },
  { entreprise: "Sunu Colis", nom_client: "Salon de coiffure Sacré-Cœur", telephone_client: "764498821", repere: "1er étage, sonnette de gauche", lat: 14.7092, lng: -17.4581 },

  // Thiès Rapide
  { entreprise: "Thiès Rapide", nom_client: "Quincaillerie Randoulène", telephone_client: "772204418", repere: "Près du marché central", lat: 14.8007, lng: -16.9312 },
  { entreprise: "Thiès Rapide", nom_client: "Boutique Diakhao", telephone_client: "709336502", repere: "Sur la route de Dakar, avant le pont", lat: 14.7823, lng: -16.9198 },
  { entreprise: "Thiès Rapide", nom_client: "Garage Grand Standing", telephone_client: "764159063", repere: null, lat: 14.7871, lng: -16.9401 },

  // Rail Express Thiès (Thiès aussi — entreprise différente)
  { entreprise: "Rail Express Thiès", nom_client: "Pharmacie Sud", telephone_client: "778821903", repere: "Face à l'ancienne gare", lat: 14.7865, lng: -16.9280 },
  { entreprise: "Rail Express Thiès", nom_client: "Boutique Cheikh Anta", telephone_client: "775663312", repere: null, lat: 14.7940, lng: -16.9330 },

  // Saly Logistique (Mbour)
  { entreprise: "Saly Logistique", nom_client: "Hôtel Saly Plage", telephone_client: "786012240", repere: "Entrée principale côté plage", lat: 14.4522, lng: -17.0025 },
  { entreprise: "Saly Logistique", nom_client: "Marché Mbour", telephone_client: "773441287", repere: "Stand n°14, allée du poisson", lat: 14.4198, lng: -16.9642 },
];

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL manquant. Copiez .env.example en .env et renseignez-le.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("→ Nettoyage des tables existantes...");
    await client.query("TRUNCATE TABLE tournees, commandes, utilisateurs, entreprises, villes RESTART IDENTITY CASCADE");

    console.log("→ Insertion des villes...");
    const villeIds = {};
    for (const v of VILLES) {
      const res = await client.query(
        `INSERT INTO villes (nom, centre_latitude, centre_longitude, zoom_defaut)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [v.nom, v.lat, v.lng, v.zoom]
      );
      villeIds[v.nom] = res.rows[0].id;
    }

    console.log("→ Insertion des entreprises...");
    const entrepriseIds = {};
    for (const e of ENTREPRISES) {
      const res = await client.query(
        `INSERT INTO entreprises (nom, ville_id, hub_nom, hub_geom)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography)
         RETURNING id`,
        [e.nom, villeIds[e.ville], e.hub_nom, e.lng, e.lat]
      );
      entrepriseIds[e.nom] = res.rows[0].id;
    }

    console.log("→ Insertion du compte administrateur...");
    const adminHash = await bcrypt.hash(SEED_PASSWORD, 10);
    await client.query(
      `INSERT INTO utilisateurs (nom, telephone, mot_de_passe_hash, role, entreprise_id)
       VALUES ($1, $2, $3, 'admin', NULL)`,
      ["Admin FatFat-App", "770000000", adminHash]
    );

    console.log("→ Insertion des utilisateurs (mot de passe commun : \"" + SEED_PASSWORD + "\")...");
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    for (const u of UTILISATEURS) {
      await client.query(
        `INSERT INTO utilisateurs (nom, telephone, mot_de_passe_hash, role, entreprise_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [u.nom, u.telephone, passwordHash, u.role, entrepriseIds[u.entreprise]]
      );
    }

    console.log("→ Insertion des commandes du jour...");
    for (const c of COMMANDES) {
      await client.query(
        `INSERT INTO commandes (nom_client, telephone_client, repere, geom, entreprise_id)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6)`,
        [c.nom_client, c.telephone_client, c.repere, c.lng, c.lat, entrepriseIds[c.entreprise]]
      );
    }

    await client.query("COMMIT");
    console.log("✓ Seed terminé.");
    console.log("");
    console.log("Comptes de démo (téléphone / mot de passe) :");
    console.log(`  770000000 / ${SEED_PASSWORD}   →  Admin FatFat-App (admin — gère les entreprises clientes)`);
    for (const u of UTILISATEURS) {
      const ent = ENTREPRISES.find((e) => e.nom === u.entreprise);
      console.log(`  ${u.telephone} / ${SEED_PASSWORD}   →  ${u.nom} (${u.role}, ${u.entreprise} — ${ent.ville})`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("✗ Échec du seed :", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
