const BASE_URL = 'http://127.0.0.1:8000'; // switch to cloud end-point

export const fetchFireData = async () => {
    const res = await fetch(`${BASE_URL}/api/v1/fires`);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
  return res.json();
};
