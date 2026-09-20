// Applique db/schema.sql sur la base pointée par DATABASE_URL.
// Usage : npm run migrate

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL manquant. Copiez .env.example en .env et renseignez-le.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  console.log("→ Application du schéma sur", process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@"));
  try {
    await pool.query(sql);
    console.log("✓ Schéma appliqué avec succès (villes, utilisateurs, commandes, tournees).");
  } catch (err) {
    console.error("✗ Échec de la migration :", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
