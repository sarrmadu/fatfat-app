"use client";

import { MapContainer, TileLayer, LayersControl, Marker, Tooltip, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const { BaseLayer } = LayersControl;

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function hubDivIcon() {
  return L.divIcon({ className: "hub-icon", html: '<div class="hub-marker">H</div>', iconSize: [30, 30], iconAnchor: [15, 15] });
}
function stopDivIcon(num, optimized) {
  return L.divIcon({
    className: "stop-icon",
    html: `<div class="stop-marker ${optimized ? "" : "plain"}"><span>${optimized ? num : ""}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}
function pickerDivIcon() {
  return L.divIcon({ className: "hub-icon", html: '<div class="hub-marker picker-dot">•</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
}

/**
 * Carte réutilisable pour deux usages :
 * - la carte principale du gestionnaire (stops + tracé optimisé + clic pour ajouter un point)
 * - le sélecteur de position de secours du livreur (pickerPos + clic pour indiquer sa position)
 */
export default function MapView({ entrepriseInfo, stops = [], optimized = false, onMapClick = null, pickerPos = null, showHub = true }) {
  return (
    <MapContainer
      center={[entrepriseInfo.centre_latitude, entrepriseInfo.centre_longitude]}
      zoom={entrepriseInfo.zoom_defaut}
      className="map-container"
    >
      <LayersControl position="topright">
        <BaseLayer checked name="Rues (OpenStreetMap)">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        </BaseLayer>
        <BaseLayer name="Satellite">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri World Imagery"
          />
        </BaseLayer>
      </LayersControl>

      {showHub && entrepriseInfo.hub_lat && (
        <Marker position={[entrepriseInfo.hub_lat, entrepriseInfo.hub_lng]} icon={hubDivIcon()}>
          <Tooltip>{entrepriseInfo.hub_nom}</Tooltip>
        </Marker>
      )}

      {stops.map((s, i) => (
        <Marker key={s.id} position={[s.lat, s.lng]} icon={stopDivIcon(i + 1, optimized)}>
          <Tooltip>
            {optimized ? `${i + 1}. ` : ""}
            {s.nom_client}
            {s.repere ? " — " + s.repere : ""}
          </Tooltip>
        </Marker>
      ))}

      {optimized && stops.length > 0 && entrepriseInfo.hub_lat && (
        <Polyline
          positions={[[entrepriseInfo.hub_lat, entrepriseInfo.hub_lng], ...stops.map((s) => [s.lat, s.lng])]}
          pathOptions={{ color: "#1e5c7a", weight: 3, dashArray: "1 8" }}
        />
      )}

      {pickerPos && <Marker position={[pickerPos.lat, pickerPos.lng]} icon={pickerDivIcon()} />}

      {onMapClick && <ClickHandler onMapClick={onMapClick} />}
    </MapContainer>
  );
}
