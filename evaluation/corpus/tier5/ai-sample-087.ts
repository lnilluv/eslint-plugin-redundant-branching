// Synthetic AI sample #087
// Pattern: parallel branching for metadata (expected plugin detection)

export function buildRoleInfo087(role: string) {
  const permissions = role === 'admin'
    ? ['read', 'write', 'delete']
    : role === 'editor'
      ? ['read', 'write']
      : role === 'viewer'
        ? ['read']
        : [];

  const dashboard = role === 'admin'
    ? 'admin-dashboard'
    : role === 'editor'
      ? 'editor-dashboard'
      : role === 'viewer'
        ? 'viewer-dashboard'
        : 'guest-dashboard';

  return { permissions, dashboard };
}
