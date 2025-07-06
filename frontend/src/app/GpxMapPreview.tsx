"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import * as togeojson from "@tmcw/togeojson";
import styles from "./page.module.css";

export default function GpxMapPreview({ fileName }: { fileName: string }) {
  const [positions, setPositions] = useState<Array<[number, number]>>([]);
  useEffect(() => {
    if (!fileName.toLowerCase().endsWith('.gpx')) return;
    fetch(`/api/file/${encodeURIComponent(fileName)}`)
      .then(res => res.text())
      .then(gpxText => {
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxText, "application/xml");
        const geojson = togeojson.gpx(gpxDoc);
        // Extract all coordinates from all LineString features
        const coords: Array<[number, number]> = [];
        geojson.features.forEach((f) => {
          if (f.geometry && f.geometry.type === "LineString") {
            (f.geometry.coordinates as [number, number][]).forEach(([lon, lat]: [number, number]) => coords.push([lat, lon]));
          }
        });
        setPositions(coords);
      });
  }, [fileName]);
  if (!fileName.toLowerCase().endsWith('.gpx') || positions.length === 0) return null;
  const center = positions[Math.floor(positions.length / 2)] as [number, number];
  return (
    <div className={styles.gpxPreview}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={positions as [number, number][]} pathOptions={{ color: "#1976d2", weight: 5 }} />
      </MapContainer>
    </div>
  );
}
