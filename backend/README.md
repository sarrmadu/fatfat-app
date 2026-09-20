# FatFat-App — API Backend

API REST (Node.js + Express + PostgreSQL/PostGIS) pour la gestion et l'optimisation
de tournées de livraison à Dakar, Thiès et Mbour.

## 1. Prérequis

- Node.js 18+
- Une base PostgreSQL avec l'extension **PostGIS** activable. Trois options équivalentes :
  - **Docker** (le plus simple en local) : `docker compose up -d` avec le `docker-compose.yml`
    fourni — PostGIS est déjà activé dans l'image, rien à configurer.
  - **Hébergé** : Supabase, Railway, Neon... PostGIS activable en un clic dans leur interface.
  - **Installation locale classique** de PostgreSQL, avec `CREATE EXTENSION postgis;` lancé
    une fois par un superutilisateur (voir la note à l'étape 3).

## 2. Installation

```bash
npm install
cp .env.example .env
```

Renseignez `DATABASE_URL` dans `.env` (et changez `JWT_SECRET` en production).

## 3. Base de données

```bash
npm run migrate   # applique db/schema.sql (crée les tables + extension PostGIS)
npm run seed       # optionnel — données de démonstration, voir avertissement ci-dessous
```

> **Note** : l'extension PostGIS doit être activée par un compte superutilisateur de la base
> (`CREATE EXTENSION postgis;`), pas par l'utilisateur applicatif standard — sinon `npm run migrate`
> échoue avec `permission denied to create extension "postgis"`. Sur une base locale, connectez-vous
> en superutilisateur (`psql` en tant que `postgres`) et lancez cette commande une fois avant de
> migrer. Sur Supabase/Railway/Neon, PostGIS est généralement activable en un clic dans leur
> interface, ou déjà actif par défaut.

**`npm run seed` est réservé au développement local.** Il crée six entreprises fictives,
leurs comptes (gestionnaires et livreurs, mot de passe commun `demo1234` par défaut,
configurable via `SEED_PASSWORD`) et des commandes du jour — utile pour tester le
cloisonnement entre entreprises concurrentes d'une même ville. **Ne jamais l'exécuter sur
une base de production** : créez plutôt le premier compte admin directement en base
(`INSERT INTO utilisateurs ... role='admin', entreprise_id=NULL`, mot de passe hashé via
`bcryptjs`), puis toutes les entreprises réelles via le panneau admin (section 9).

| Téléphone | Rôle | Entreprise | Ville |
|-----------|------|------------|-------|
| 770000000 | admin | — | — |
| 770000001 | gestionnaire | Teranga Shop | Dakar |
| 770000002 / 770000003 | livreur | Teranga Shop | Dakar |
| 770000010 / 770000011 | gestionnaire / livreur | Dakar Express Delivery | Dakar |
| 770000020 / 770000021 | gestionnaire / livreur | Sunu Colis | Dakar |
| 770000004 / 770000005 | gestionnaire / livreur | Thiès Rapide | Thiès |
| 770000030 / 770000031 | gestionnaire / livreur | Rail Express Thiès | Thiès |
| 770000006 / 770000007 | gestionnaire / livreur | Saly Logistique | Mbour |

Teranga Shop, Dakar Express Delivery et Sunu Colis sont trois entreprises distinctes,
toutes à Dakar — ce jeu de données sert précisément à vérifier qu'elles ne se voient
jamais entre elles.

## 4. Démarrage

```bash
npm run dev     # avec rechargement automatique (nodemon)
npm start        # production
```

Le serveur écoute sur `http://localhost:4000` (configurable via `PORT`).
Vérification rapide : `curl http://localhost:4000/api/health`.

## 5. Le cloisonnement par entreprise

Le cloisonnement se fait par **entreprise**, pas par ville. Plusieurs entreprises
concurrentes peuvent opérer dans la même ville — c'est même le cas courant — sans jamais
se voir. La ville n'est qu'une donnée géographique pour centrer la carte, sans rôle de
sécurité.

Chaque compte est rattaché à une seule entreprise (`utilisateurs.entreprise_id`), et
chaque entreprise a sa propre ville et son propre hub (`entreprises.ville_id`,
`entreprises.hub_geom`). Ce `entreprise_id` est embarqué dans le token JWT à la connexion.
Toutes les routes filtrent leurs requêtes SQL par `entreprise_id = req.user.entreprise_id`,
une valeur lue depuis le token — jamais depuis le body, les query params ou l'URL envoyés
par le client. Un gestionnaire de "Teranga Shop" ne peut donc ni voir, ni modifier, ni
assigner une tournée aux données de "Dakar Express Delivery", même dans la même ville et
même en forçant des identifiants — vérifié par les tests automatisés (section 7).

## 6. Endpoints principaux

Toutes les routes protégées attendent l'en-tête `Authorization: Bearer <token>`.

### Authentification