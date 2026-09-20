// Exécuté UNE FOIS avant toute la suite : applique le schéma puis le seed sur la base de test,
// dans des process séparés (comme le ferait un développeur en CLI), pour repartir d'un état propre.
const { execSync } = require("child_process");
const path = require("path");

module.exports = async () => {
  const url = process.env.DATABASE_URL_TEST || "postgresql://logiroute:logiroute@localhost:5432/logiroute_test";
  const cwd = path.join(__dirname, "..");
  const env = { ...process.env, DATABASE_URL: url, SEED_PASSWORD: "demo1234" };

  execSync("node db/migrate.js", { cwd, env, stdio: "inherit" });
  execSync("node db/seed.js", { cwd, env, stdio: "inherit" });
};
