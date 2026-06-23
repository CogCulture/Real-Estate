import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/renders';

export async function queueRenderJob(renderJobData) {
  const res = await axios.post(API_BASE, renderJobData);
  return res.data;
}

export async function fetchRenderJobStatus(jobId) {
  const res = await axios.get(`${API_BASE}/${jobId}`);
  return res.data;
}

export async function fetchProjectRenders(projectId) {
  const res = await axios.get(`${API_BASE}/project/${projectId}`);
  return res.data;
}

export function getDownloadUrl(jobId) {
  return `${API_BASE}/${jobId}/download`;
}
