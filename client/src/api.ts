import axios from 'axios';
import type { Event, Stats } from './types';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const login = async (username: string, password: string) => {
  const { data } = await api.post('/auth/login', { username, password });
  return data;
};

export const getEvents = async (): Promise<Event[]> => {
  const { data } = await api.get('/events');
  return data;
};

export const createEvent = async (payload: Partial<Event>): Promise<Event> => {
  const { data } = await api.post('/events', payload);
  return data;
};

export const updateEvent = async (id: number, payload: Partial<Event>): Promise<Event> => {
  const { data } = await api.put(`/events/${id}`, payload);
  return data;
};

export const deleteEvent = async (id: number): Promise<void> => {
  await api.delete(`/events/${id}`);
};

export const getStats = async (): Promise<Stats> => {
  const { data } = await api.get('/stats');
  return data;
};

export const getBudget = async (year: number) => {
  const { data } = await api.get(`/budget/${year}`);
  return data;
};

export const updateScenario = async (id: number, payload: { amount: number; name?: string }) => {
  const { data } = await api.put(`/budget/scenarios/${id}`, payload);
  return data;
};
