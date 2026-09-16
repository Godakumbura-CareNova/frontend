const DEFAULT_API_BASE_URL = 'http://localhost:5133/api';

export const resolveApiBaseUrl = (configured) => {
  const raw = (configured || '').trim();

  if (!raw) {
    return DEFAULT_API_BASE_URL;
  }

  return raw.replace(/\/+$/, '');
};

export default resolveApiBaseUrl;
