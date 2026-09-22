"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // échec silencieux : l'app reste utilisable sans le SW
      });
    }
  }, []);

  return null;
}