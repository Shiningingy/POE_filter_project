// src/services/api.ts
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export interface ThemesResponse {
  themes: string[];
}

export const getThemes = async (): Promise<ThemesResponse> => {
  const response = await axios.get(`${API_BASE_URL}/themes`);
  return response.data;
};
