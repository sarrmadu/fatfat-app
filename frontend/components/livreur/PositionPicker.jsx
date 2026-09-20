"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("../MapView"), {
  ssr: false,
  loading: () => <div className="loading-note">Chargement de la carte...</div>,
});

export default function PositionPicker({ entrepriseInfo, onConfirm }) {
  const [pos, setPos] = useState(null);

  return (
    <div>
      <div className="picker-hint">Touchez la carte à l'endroit où vous vous trouvez.</div>
      <div className="picker-map">
        <MapView entrepriseInfo={entrepriseInfo} pickerPos={pos} showHub={false} onMapClick={(lat, lng) => setPos({ lat, lng })} />
      </div>
      <button className="btn btn-primary" disabled={!pos} onClick={() => pos && onConfirm(pos)}>
        Confirmer cette position
      </button>
    </div>
  );
}
