"use client";

export default function Ticket({ etape, num, onStatusChange }) {
  const statusClass = { attente: "", encours: "status-encours", livre: "status-livre", echec: "status-echec" }[etape.statut] || "";
  const pillClass = { attente: "", encours: "encours", livre: "livre", echec: "echec" }[etape.statut] || "";
  const pillLabel = { attente: "En attente", encours: "En cours", livre: "Livré", echec: "Échec" }[etape.statut];
  const gpsUrl = `https://www.google.com/maps/dir/?api=1&destination=${etape.lat},${etape.lng}`;

  return (
    <div className={`ticket ${statusClass}`}>
      <div className="ticket-head">
        <div className="step-num">{num}</div>
        <div>
          <div className="ticket-name">{etape.nom_client}</div>
          <div className="ticket-phone">{etape.telephone_client || "—"}</div>
        </div>
        <div className={`status-pill ${pillClass}`}>{pillLabel}</div>
      </div>
      {etape.repere && <div className="ticket-repere">{etape.repere}</div>}
      <div className="ticket-body">
        <a className="btn-gps" href={gpsUrl} target="_blank" rel="noopener noreferrer">Ouvrir dans Maps →</a>
        {etape.statut === "attente" && (
          <button className="btn btn-encours" onClick={() => onStatusChange(etape.id, "encours")}>Démarrer</button>
        )}
        {etape.statut === "encours" && (
          <>
            <button className="btn btn-livre" onClick={() => onStatusChange(etape.id, "livre")}>Livré ✓</button>
            <button className="btn btn-echec" onClick={() => onStatusChange(etape.id, "echec")}>Échec</button>
          </>
        )}
        {(etape.statut === "livre" || etape.statut === "echec") && (
          <button className="btn btn-ghost" onClick={() => onStatusChange(etape.id, "attente")}>Réinitialiser</button>
        )}
      </div>
    </div>
  );
}
