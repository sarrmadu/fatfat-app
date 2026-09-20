/**
 * Client API minimal. Contrairement au prototype HTML, la base URL et le token
 * peuvent être persistés dans localStorage — ceci est un vrai projet Next.js exécuté
 * dans le navigateur de l'utilisateur, pas un artifact prévisualisé dans une iframe.
 */
export async function apiCall(baseUrl, path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;

  let res;
  try {
    res = await fetch(baseUrl + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error(`Impossible de joindre l'API (${baseUrl}). Vérifiez l'URL et que le serveur tourne.`);
  }

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* réponse vide, ex: DELETE */
  }

  if (!res.ok) {
    throw new Error((data && data.error) || `Erreur HTTP ${res.status}`);
  }
  return data;
}
