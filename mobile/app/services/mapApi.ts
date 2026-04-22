import { ResourceType } from "../(tabs)/map/resourceTypes";
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://54.193.8.1:8000';

const NEARBY_RESOURCES_CACHE_PREFIX = 'ashguard:nearby_resources';
const NEARBY_RESOURCES_CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes
const COORDINATE_SNAP_DECIMALS = 3; // about 100m-ish grid
const BASE_RADIUS = 25000; // 25km radius

type NearbyResourcesCacheEntry = {
  cachedAt: number;
  data: any;
};

const inMemoryNearbyResourcesCache = new Map<string, NearbyResourcesCacheEntry>();

const snapCoordinate = (value: number) => {
  return Number(value.toFixed(COORDINATE_SNAP_DECIMALS));
};

const buildNearbyResourcesCacheKey = (payload: {
  latitude: number;
  longitude: number;
  type: ResourceType;
}) => {
  const snappedLat = snapCoordinate(payload.latitude);
  const snappedLon = snapCoordinate(payload.longitude);

  return [
    NEARBY_RESOURCES_CACHE_PREFIX,
    payload.type,
    snappedLat,
    snappedLon,
  ].join(':');
};

const isFreshCacheEntry = (entry: NearbyResourcesCacheEntry | null) => {
  if (!entry) return false;
  return Date.now() - entry.cachedAt < NEARBY_RESOURCES_CACHE_TTL_MS;
};

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
  forceRefresh?: boolean;
}) => {
  const {
    latitude,
    longitude,
    type,
    radius = BASE_RADIUS,
    limit = 100,
    forceRefresh = false,
  } = payload;

  const normalizedPayload = {
    latitude,
    longitude,
    type,
    radius,
    limit,
  };

  const cacheKey = buildNearbyResourcesCacheKey(normalizedPayload);

  if (!forceRefresh) {
    const memoryEntry = inMemoryNearbyResourcesCache.get(cacheKey) ?? null;
    if (isFreshCacheEntry(memoryEntry)) {
      return memoryEntry!.data;
    }

    try {
      const storedValue = await AsyncStorage.getItem(cacheKey);
      if (storedValue) {
        const parsedEntry = JSON.parse(storedValue) as NearbyResourcesCacheEntry;

        if (isFreshCacheEntry(parsedEntry)) {
          inMemoryNearbyResourcesCache.set(cacheKey, parsedEntry);
          return parsedEntry.data;
        }

        await AsyncStorage.removeItem(cacheKey);
      }
    } catch (error) {
      console.warn('Failed to read nearby resources cache:', error);
    }
  }

  const params = new URLSearchParams({
    lat: latitude.toString(),
    lon: longitude.toString(),
    type,
    radius: radius.toString(),
    limit: Math.round(limit).toString(),
  });

  const res = await fetch(`${BASE_URL}/api/v1/places/nearby?${params}`);
  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

  const data = await res.json();

  const cacheEntry: NearbyResourcesCacheEntry = {
    cachedAt: Date.now(),
    data,
  };

  inMemoryNearbyResourcesCache.set(cacheKey, cacheEntry);

  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
  } catch (error) {
    console.warn('Failed to write nearby resources cache:', error);
  }

  return data;
};
