-- =========================================================
-- FatFat-App — Schéma de base de données
-- PostgreSQL + PostGIS
-- =========================================================
--
-- Hiérarchie : Ville (géographie) → Entreprise (le client payant,
-- avec son propre hub de départ) → Utilisateurs / Commandes / Tournées.
--
-- IMPORTANT : le cloisonnement des données se fait par ENTREPRISE,
-- jamais par ville. Plusieurs entreprises concurrentes peuvent opérer
-- dans la même ville sans jamais voir les données les unes des autres.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------
-- Table villes
-- Purement géographique : sert à centrer la carte. N'est PLUS
-- une frontière de cloisonnement (voir table entreprises).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS villes (
  id                SERIAL PRIMARY KEY,
  nom               VARCHAR(50) NOT NULL UNIQUE,   -- "Dakar", "Thiès", "Mbour"
  centre_latitude   DOUBLE PRECISION NOT NULL,
  centre_longitude  DOUBLE PRECISION NOT NULL,
  zoom_defaut       INT NOT NULL DEFAULT 13
);

-- ---------------------------------------------------------
-- Table entreprises
-- LE VRAI PÉRIMÈTRE DE CLOISONNEMENT. Un client payant = une entreprise.
-- Plusieurs entreprises peuvent partager la même ville (villes.id) sans
-- jamais voir les commandes, tournées ou livreurs les unes des autres.
-- Chaque entreprise a son propre hub (point de départ des tournées).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS entreprises (
  id           SERIAL PRIMARY KEY,
  nom          VARCHAR(150) NOT NULL,
  ville_id     INT NOT NULL REFERENCES villes(id),
  hub_nom      VARCHAR(100) NOT NULL,
  hub_geom     GEOGRAPHY(POINT, 4326) NOT NULL,
  actif        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entreprises_ville ON entreprises(ville_id);

-- ---------------------------------------------------------
-- Table utilisateurs
-- Trois rôles :
--   - admin         : réservé à l'exploitant de FatFat-App. Pas rattaché à une
--                     entreprise (entreprise_id NULL) — gère la liste des entreprises
--                     clientes via /api/admin/*, mais n'a accès à AUCUNE commande,
--                     tournée ou livreur d'une entreprise (cloisonnement total).
--   - gestionnaire  : rattaché à UNE entreprise, gère ses commandes/tournées/livreurs.
--   - livreur       : rattaché à UNE entreprise, consulte/exécute sa tournée.
-- La contrainte CHECK garantit qu'un admin n'a jamais d'entreprise_id, et qu'un
-- gestionnaire/livreur en a toujours un — impossible d'avoir un état incohérent.
-- C'est ce entreprise_id, lu depuis le token JWT après connexion, qui impose le
-- cloisonnement — jamais une valeur envoyée par le client.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateurs (
  id                 SERIAL PRIMARY KEY,
  nom                VARCHAR(100) NOT NULL,
  telephone          VARCHAR(20) NOT NULL UNIQUE,
  mot_de_passe_hash  TEXT NOT NULL,
  role               VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'gestionnaire', 'livreur')),
  entreprise_id      INT REFERENCES entreprises(id),
  capacite_max       INT,                            -- colis max/tournée pour un livreur ; NULL = illimité
  actif              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_entreprise_selon_role CHECK (
    (role = 'admin' AND entreprise_id IS NULL) OR
    (role IN ('gestionnaire', 'livreur') AND entreprise_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_utilisateurs_entreprise ON utilisateurs(entreprise_id);

-- ---------------------------------------------------------
-- Table commandes
-- geom : le "pointage cartographique manuel" du cahier des charges —
-- un point GPS posé sur la carte, sans dépendre d'une adresse textuelle fiable.
-- repere : indication textuelle complémentaire (ex: "face à la pharmacie, portail bleu").
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS commandes (
  id                 SERIAL PRIMARY KEY,
  nom_client         VARCHAR(150) NOT NULL,
  telephone_client   VARCHAR(20),
  repere             TEXT,
  geom               GEOGRAPHY(POINT, 4326) NOT NULL,
  statut             VARCHAR(20) NOT NULL DEFAULT 'attente'
                       CHECK (statut IN ('attente', 'encours', 'livre', 'echec')),
  entreprise_id      INT NOT NULL REFERENCES entreprises(id),
  date_livraison     DATE NOT NULL DEFAULT CURRENT_DATE,
  cree_par           INT REFERENCES utilisateurs(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commandes_geom             ON commandes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_commandes_entreprise_date  ON commandes(entreprise_id, date_livraison);

-- ---------------------------------------------------------
-- Table tournees
-- etapes_ordonnees : tableau JSON des id de commandes, dans l'ordre calculé
-- par l'algorithme d'optimisation (voir src/services/optimizer.js).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournees (
  id                 SERIAL PRIMARY KEY,
  livreur_id         INT NOT NULL REFERENCES utilisateurs(id),
  entreprise_id      INT NOT NULL REFERENCES entreprises(id),
  date_creation      DATE NOT NULL DEFAULT CURRENT_DATE,
  etapes_ordonnees   JSONB NOT NULL,
  distance_km        NUMERIC(6,2),
  cree_par           INT REFERENCES utilisateurs(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournees_entreprise_date ON tournees(entreprise_id, date_creation);
CREATE INDEX IF NOT EXISTS idx_tournees_livreur_date    ON tournees(livreur_id, date_creation);

-- ---------------------------------------------------------
-- Migration idempotente : autorise le rôle "admin" et entreprise_id NULL sur une
-- base déjà migrée avec l'ancien schéma (sans admin). Sans effet sur une base neuve
-- (la table vient d'être créée avec la bonne définition ci-dessus).
-- ---------------------------------------------------------
ALTER TABLE utilisateurs ALTER COLUMN entreprise_id DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_role_check;
  ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_role_check
    CHECK (role IN ('admin', 'gestionnaire', 'livreur'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE utilisateurs ADD CONSTRAINT chk_entreprise_selon_role CHECK (
    (role = 'admin' AND entreprise_id IS NULL) OR
    (role IN ('gestionnaire', 'livreur') AND entreprise_id IS NOT NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
