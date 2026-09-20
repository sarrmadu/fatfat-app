const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { statsDuJour } = require("../controllers/statsController");

const router = express.Router();

router.get("/", requireAuth("gestionnaire"), statsDuJour);

module.exports = router;
