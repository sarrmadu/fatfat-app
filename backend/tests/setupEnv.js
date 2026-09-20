// Exécuté par Jest AVANT le chargement de chaque fichier de test — fixe l'environnement
// pour pointer vers la base de test, avant que dotenv (dans src/server.js) ne s'exécute.
// dotenv ne réécrit jamais une variable déjà définie, donc ces valeurs priment.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || "postgresql://logiroute:logiroute@localhost:5432/logiroute_test";
process.env.JWT_SECRET = "test-secret-ne-pas-utiliser-en-prod";
process.env.SEED_PASSWORD = "demo1234";
