import axios from 'axios';

const API_BASE = '/api/projects';

export async function fetchProjects() {
  const res = await axios.get(API_BASE);
  return res.data;
}

export async function fetchProjectById(id) {
  const res = await axios.get(`${API_BASE}/${id}`);
  return res.data;
}

export async function createProject(projectData) {
  const res = await axios.post(API_BASE, projectData);
  return res.data;
}

export async function updateProject(id, projectData) {
  const res = await axios.put(`${API_BASE}/${id}`, projectData);
  return res.data;
}

export async function deleteProject(id) {
  await axios.delete(`${API_BASE}/${id}`);
}
