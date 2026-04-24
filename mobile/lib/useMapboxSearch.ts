import { useCallback, useRef, useState } from "react";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

export type MapboxSuggestion = {
  placeId: string;
  label: string;
  shortLabel: string;
  coords: [number, number]; // [longitude, latitude]
  category?: string;
};

type MapboxFeature = {
  id: string;
  place_name: string;
  text?: string;
  place_type?: string[];
  center: [number, number];
};

const DEFAULT_PROXIMITY: [number, number] = [-118.2437, 34.0522]; // LA fallback

export function useMapboxSearch() {
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (input: string, proximityCoords?: [number, number] | null) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const query = input.trim();
      if (!query || !MAPBOX_TOKEN) {
        setSuggestions([]);
        return;
      }

      const [lon, lat] = proximityCoords ?? DEFAULT_PROXIMITY;

      debounceRef.current = setTimeout(async () => {
        try {
          setLoading(true);

          const url =
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
            `?access_token=${MAPBOX_TOKEN}` +
            `&autocomplete=true` +
            `&country=us` +
            `&types=address,place,neighborhood,locality,poi` +
            `&proximity=${lon},${lat}` +
            `&limit=6`;

          const res = await fetch(url);
          const data = await res.json();

          const next: MapboxSuggestion[] = (data?.features ?? []).map(
            (f: MapboxFeature) => ({
              placeId: f.id,
              label: f.place_name,
              shortLabel: f.text ?? f.place_name,
              coords: f.center,
              category: f.place_type?.[0],
            })
          );

          setSuggestions(next);
        } catch (error) {
          console.error("Mapbox autocomplete error:", error);
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    []
  );

  const clear = useCallback(() => {
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return { suggestions, loading, search, clear };
}

export async function geocodeAddressWithMapbox(
  input: string,
  proximityCoords?: [number, number] | null
): Promise<{ latitude: number; longitude: number } | null> {
  const query = input.trim();
  if (!query || !MAPBOX_TOKEN) return null;

  const [lon, lat] = proximityCoords ?? DEFAULT_PROXIMITY;

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${MAPBOX_TOKEN}` +
      `&autocomplete=false` +
      `&country=us` +
      `&types=address,place,neighborhood,locality,poi` +
      `&proximity=${lon},${lat}` +
      `&limit=1`;

    const res = await fetch(url);
    const data = await res.json();
    const feature = data?.features?.[0] as MapboxFeature | undefined;

    if (!feature?.center) return null;

    return {
      latitude: feature.center[1],
      longitude: feature.center[0],
    };
  } catch (error) {
    console.error("Mapbox geocode error:", error);
    return null;
  }
}