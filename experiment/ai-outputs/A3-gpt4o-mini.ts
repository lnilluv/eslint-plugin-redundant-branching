type NotifType = 'info' | 'warning' | 'error' | 'success';

export function renderNotification(type: NotifType, message: string) {
  const icon =
    type === 'info' ? 'ℹ️'
    : type === 'warning' ? '⚠️'
    : type === 'error' ? '❌'
    : '✅';

  const backgroundColor =
    type === 'info' ? '#d1ecf1'
    : type === 'warning' ? '#fff3cd'
    : type === 'error' ? '#f8d7da'
    : '#d4edda';

  return { icon, backgroundColor, message };
}
