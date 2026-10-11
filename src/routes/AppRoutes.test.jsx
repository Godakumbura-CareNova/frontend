import { describe, expect, it } from 'vitest';
import { createRoutesFromElements, matchRoutes } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleProtectedRoute from '../components/RoleProtectedRoute';

const matchesFor = (path) => matchRoutes(createRoutesFromElements(AppRoutes().props.children), path);
const hasAccessGuard = (matches) => matches.some(({ route }) =>
  [ProtectedRoute, RoleProtectedRoute].includes(route.element?.type));

describe('public browsing and protected patient actions', () => {
  it.each(['/patient/medicines/1', '/patient/doctors/doctor-1', '/about', '/contact'])(
    'keeps %s accessible without authentication', (path) => {
      const matches = matchesFor(path);
      expect(matches).not.toBeNull();
      expect(hasAccessGuard(matches)).toBe(false);
    },
  );

  it.each(['/patient/doctors/doctor-1/book', '/patient/appointments/appointment-1', '/patient/checkout'])(
    'requires authentication for %s', (path) => {
      const matches = matchesFor(path);
      expect(matches).not.toBeNull();
      expect(hasAccessGuard(matches)).toBe(true);
    },
  );
});
