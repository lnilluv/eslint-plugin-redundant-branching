// Notification center

type NotifType = 'info' | 'warning' | 'error' | 'success';

export function renderNotification(type: NotifType, message: string) {
  const icon =
    type === 'info' ? 'ℹ️'
    : type === 'warning' ? '⚠️'
    : type === 'error' ? '❌'
    : '✅';

  return { icon, message };
}
