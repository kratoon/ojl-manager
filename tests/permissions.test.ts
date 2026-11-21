import { describe, expect, it } from 'vitest';
import { can, defaultMode, features } from '../src/permissions/permissions';
import { parseHash, routePermissions, type RouteName } from '../src/router';

describe('defaultMode', () => {
  it('is edit on every host (data is a local file, ADR-112163d)', () => {
    expect(defaultMode()).toBe('edit');
  });
});

describe('can', () => {
  it('view mode grants only view permissions', () => {
    expect(can('view', 'employees:view')).toBe(true);
    expect(can('view', 'employees:edit')).toBe(false);
  });

  it('edit mode grants view and edit', () => {
    expect(can('edit', 'employees:view')).toBe(true);
    expect(can('edit', 'employees:edit')).toBe(true);
  });
});

describe('routes', () => {
  it('every route declares a permission for a known feature', () => {
    for (const [route, permission] of Object.entries(routePermissions) as [RouteName, string][]) {
      expect(features, route).toContain(permission.split(':')[0]);
    }
  });
});

describe('router', () => {
  it('parses the employee edit route', () => {
    expect(parseHash('#/employees/abc')).toEqual({ name: 'employee', id: 'abc' });
    expect(parseHash('#/employees')).toEqual({ name: 'employees' });
    expect(parseHash('#/nope')).toEqual({ name: 'home' });
  });

  it('requires the edit permission for the employee page', () => {
    expect(can('view', routePermissions.employee)).toBe(false);
    expect(can('edit', routePermissions.employee)).toBe(true);
  });
});
