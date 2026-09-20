const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { monEntreprise } = require("../controllers/entreprisesController");

const router = express.Router();

router.get("/moi", requireAuth(), monEntreprise);

module.exports = router;
