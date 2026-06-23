import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/layouts';

export async function fetchLatestLayout(projectId) {
  const res = await axios.get(`${API_BASE}/${projectId}`);
  return res.data;
}

export async function saveLayout(layoutData) {
  const res = await axios.post(API_BASE, layoutData);
  return res.data;
}

export async function updateLayout(layoutId, layoutData) {
  const res = await axios.put(`${API_BASE}/${layoutId}`, layoutData);
  return res.data;
}

export async function fetchAllLayoutVersions(projectId) {
  const res = await axios.get(`${API_BASE}/${projectId}/all`);
  return res.data;
}
