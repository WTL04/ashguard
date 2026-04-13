import { ResourceType } from "../(tabs)/map/resourceTypes";

const BASE_URL = 'http://54.193.8.1:8000';

export const fetchFireData = async () => {
  const res = await fetch(`${BASE_URL}/api/v1/geoData`);
  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  return res.json();
};

export const fetchWeatherData = async () => {
  const res = await fetch(`${BASE_URL}/api/v1/geoData`);
  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  return res.json();
};

export const checkCacheHealth = async () => {
  const res = await fetch(`${BASE_URL}/api/v1/cache/status`);
  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  return res.json();
};

export const submitSelfReport = async (payload: {
  latitude: number;
  longitude: number;
  description?: string;
}) => {
  const res = await fetch(`${BASE_URL}/api/v1/self-reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  return res.json();
};

export const fetchSelfReports = async () => {
  const res = await fetch(`${BASE_URL}/api/v1/self-reports`);
  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  return res.json();
};

export const fetchNearbyResources = async (payload: {
  latitude: number;
  longitude: number;
  type: ResourceType;
  radius?: number;
  limit?: number;
}) => {
  const {
    latitude,
    longitude,
    type,
    radius = 10000, // in meters
    limit = 999999, // no limit - show all available
  } = payload;

  const params = new URLSearchParams({
    lat: latitude.toString(),
    lon: longitude.toString(),
    type,
    radius: Math.round(radius).toString(),
    limit: Math.round(limit).toString(),
  });

  const res = await fetch(`${BASE_URL}/api/v1/places/nearby?${params}`);
  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  return res.json();
};