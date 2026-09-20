const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("⚠ DATABASE_URL n'est pas défini — les requêtes vers la base échoueront.");
}

// Les bases distantes (Supabase, Railway, Neon...) exigent une connexion chiffrée (SSL).
// Une base locale (localhost/127.0.0.1) n'en a pas besoin et n'expose généralement pas
// de certificat — on active donc le SSL seulement quand ce n'est pas du local.
const estLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: estLocal ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Erreur inattendue sur le pool PostgreSQL :", err);
});

module.exports = pool;
