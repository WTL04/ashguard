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