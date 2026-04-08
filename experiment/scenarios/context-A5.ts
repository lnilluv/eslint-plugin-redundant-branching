// Task tracker component

type Priority = 'low' | 'medium' | 'high' | 'critical';

export function getPriorityDisplay(priority: Priority) {
  const color =
    priority === 'low' ? '#6b7280'
    : priority === 'medium' ? '#f59e0b'
    : priority === 'high' ? '#ef4444'
    : '#dc2626';

  return { color };
}
