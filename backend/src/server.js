require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const entreprisesRoutes = require("./routes/entreprises.routes");
const commandesRoutes = require("./routes/commandes.routes");
const tourneesRoutes = require("./routes/tournees.routes");
const utilisateursRoutes = require("./routes/utilisateurs.routes");
const statsRoutes = require("./routes/stats.routes");
const adminRoutes = require("./routes/admin.routes");
const { errorHandler } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();

app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/entreprises", entreprisesRoutes);
app.use("/api/commandes", commandesRoutes);
app.use("/api/tournees", tourneesRoutes);
app.use("/api/utilisateurs", utilisateursRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => res.status(404).json({ error: "Route introuvable." }));
app.use(errorHandler);

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`FatFat-App API démarrée sur http://localhost:${PORT}`);
  });
}
