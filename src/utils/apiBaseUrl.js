const DEFAULT_API_BASE_URL = 'http://localhost:5133/api';

// Backend controllers are mounted under /api. Deployments sometimes supply only the
// host (e.g. https://carenova-gateway-....azurewebsites.net), which would make every
// call hit /auth/... instead of /api/auth/..., so normalise here rather than trusting
// each environment to remember the suffix.
export const resolveApiBaseUrl = (configured) => {
  const raw = (configured || '').trim();
  if (!raw) {
    return DEFAULT_API_BASE_URL;
  }

  const withoutTrailingSlash = raw.replace(/\/+$/, '');
  return withoutTrailingSlash.endsWith('/api')
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
};

export default resolveApiBaseUrl;
