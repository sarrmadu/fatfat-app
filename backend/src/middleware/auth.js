const jwt = require("jsonwebtoken");

/**
 * Signe un token JWT contenant l'identité ET l'entreprise de l'utilisateur.
 * C'est ce `entreprise_id` embarqué dans le token — pas un paramètre envoyé par le
 * client — qui garantit le cloisonnement : aucune route ne doit jamais faire confiance
 * à un entreprise_id fourni dans le body, les query params ou l'URL.
 * Plusieurs entreprises peuvent partager la même ville ; la ville n'est qu'une donnée
 * d'affichage (centrage carte), jamais une frontière de cloisonnement.
 */
function signToken(utilisateur) {
  return jwt.sign(
    {
      id: utilisateur.id,
      nom: utilisateur.nom,
      role: utilisateur.role,
      entreprise_id: utilisateur.entreprise_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
  );
}

/**
 * Vérifie le token Bearer et attache req.user = {id, nom, role, entreprise_id}.
 * Si `roles` est fourni (ex: requireAuth('gestionnaire')), rejette les rôles non autorisés.
 */
function requireAuth(...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Authentification requise." });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
    } catch (err) {
      return res.status(401).json({ error: "Token invalide ou expiré." });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé pour ce rôle." });
    }

    next();
  };
}

module.exports = { signToken, requireAuth };
