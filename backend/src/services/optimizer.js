const { haversineKm } = require("./geo");

/**
 * Construction initiale par plus proche voisin, en partant de `start`.
 * `points` doit être un tableau d'objets avec au moins {id, lat, lng}.
 * Retourne un tableau ordonné (même objets, réordonnés).
 */
function nearestNeighborRoute(start, points) {
  const remaining = [...points];
  const route = [];
  let current = start;

  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm(current, p);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    const next = remaining.splice(bestIdx, 1)[0];
    route.push(next);
    current = next;
  }
  return route;
}

/** Distance totale d'un trajet ouvert : start -> route[0] -> route[1] -> ... -> route[n-1]. */
function totalDistance(start, route) {
  if (route.length === 0) return 0;
  let total = haversineKm(start, route[0]);
  for (let i = 0; i < route.length - 1; i++) {
    total += haversineKm(route[i], route[i + 1]);
  }
  return total;
}

/**
 * Amélioration 2-opt : essaie d'inverser des segments du trajet pour le raccourcir.
 * `start` reste fixe (c'est le hub ou la position du livreur), seul l'ordre des points
 * livrables est modifié. S'arrête dès qu'un passage complet ne trouve plus d'amélioration,
 * ou après `maxPasses` passages (garde-fou pour de très longues listes).
 */
function twoOptImprove(start, route, maxPasses = 60) {
  if (route.length < 3) return route;

  let improved = true;
  let passes = 0;
  let best = [...route];

  while (improved && passes < maxPasses) {
    improved = false;
    passes++;

    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const a = i === 0 ? start : best[i - 1];
        const b = best[i];
        const c = best[j];
        const d = j === best.length - 1 ? null : best[j + 1];

        const distanceActuelle = haversineKm(a, b) + (d ? haversineKm(c, d) : 0);
        const distanceInversee = haversineKm(a, c) + (d ? haversineKm(b, d) : 0);

        if (distanceInversee < distanceActuelle - 1e-9) {
          const segment = best.slice(i, j + 1).reverse();
          best = [...best.slice(0, i), ...segment, ...best.slice(j + 1)];
          improved = true;
        }
      }
    }
  }

  return best;
}

/**
 * Point d'entrée principal : calcule la tournée optimisée à partir d'un point de départ
 * (le hub de la ville pour un calcul initial, ou la position GPS du livreur pour une
 * réoptimisation en cours de route) et d'une liste de commandes à livrer.
 *
 * Stratégie : construction gloutonne (plus proche voisin) puis raffinement local (2-opt).
 * C'est un compromis pragmatique pour du Node.js pur : sans dépendance externe, on obtient
 * des tournées très proches de l'optimal pour les volumes réalistes (jusqu'à ~50-60 arrêts).
 * Pour des volumes plus importants ou une garantie d'optimalité plus forte, la marche
 * naturelle est de déporter ce calcul vers un micro-service Python utilisant Google OR-Tools
 * (voir la section "Aller plus loin" du README).
 */
function optimiserTournee(start, points) {
  if (!points.length) {
    return { ordre: [], distanceKm: 0 };
  }
  const routeInitiale = nearestNeighborRoute(start, points);
  const routeAmeliree = twoOptImprove(start, routeInitiale);
  return {
    ordre: routeAmeliree,
    distanceKm: Math.round(totalDistance(start, routeAmeliree) * 100) / 100,
  };
}

module.exports = { optimiserTournee, nearestNeighborRoute, twoOptImprove, totalDistance };
