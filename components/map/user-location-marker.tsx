"use client";

import { useEffect, useRef, useId } from "react";
import { useMap } from "@/components/map/leaflet-react";
import L from "leaflet";

interface UserLocationMarkerProps {
  position: GeolocationPosition;
  heading: number | null;
}

export function UserLocationMarker({ position, heading }: UserLocationMarkerProps) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const gradientId = useId().replace(/:/g, "");

  useEffect(() => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    const latlng = L.latLng(lat, lng);
    const dotOpacity = accuracy > 100 ? 0.5 : 1;

    const headingRotation = heading !== null ? heading : 0;
    const showHeading = heading !== null;

    const markerHtml = `
      <div class="user-location-container">
        ${showHeading ? `
          <div class="user-location-cone" style="transform: rotate(${headingRotation}deg)">
            <svg viewBox="0 0 100 100" width="80" height="80">
              <defs>
                <linearGradient id="coneGradient-${gradientId}" x1="50%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" style="stop-color: rgba(66, 133, 244, 0.4)" />
                  <stop offset="100%" style="stop-color: rgba(66, 133, 244, 0)" />
                </linearGradient>
              </defs>
              <path d="M50,50 L30,5 Q50,-5 70,5 Z" fill="url(#coneGradient-${gradientId})" />
            </svg>
          </div>
        ` : ""}
        <div class="user-location-dot" style="opacity: ${dotOpacity}">
          <div class="user-location-dot-inner"></div>
        </div>
      </div>
    `;

    const icon = L.divIcon({
      className: "user-location-marker",
      html: markerHtml,
      iconSize: [80, 80],
      iconAnchor: [40, 40],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
      markerRef.current.setIcon(icon);
    } else {
      markerRef.current = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map);
    }

    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng(latlng);
      accuracyCircleRef.current.setRadius(accuracy);
    } else {
      accuracyCircleRef.current = L.circle(latlng, {
        radius: accuracy,
        className: "user-location-accuracy",
        color: "#3b82f6",
        weight: 1,
        opacity: 0.25,
        fillColor: "#3b82f6",
        fillOpacity: 0.12,
      }).addTo(map);
    }
  }, [map, position, heading, gradientId]);

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
    };
  }, []);

  return null;
}
