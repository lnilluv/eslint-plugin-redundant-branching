type UserRole = 'admin' | 'editor' | 'viewer' | 'guest';

export function getRoleConfig(role: UserRole) {
  const canEdit =
    role === 'admin' ? true
    : role === 'editor' ? true
    : role === 'viewer' ? false
    : false;

  const canDelete =
    role === 'admin' ? true
    : role === 'editor' ? false
    : role === 'viewer' ? false
    : false;

  const roleLabel =
    role === 'admin' ? 'Administrator'
    : role === 'editor' ? 'Editor'
    : role === 'viewer' ? 'Viewer'
    : 'Guest';

  return { canEdit, canDelete, roleLabel };
}
