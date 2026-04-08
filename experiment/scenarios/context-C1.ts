// Theme system — existing code with multiple chains

type Theme = 'light' | 'dark' | 'system' | 'high-contrast';

export function getThemeConfig(theme: Theme) {
  const backgroundColor =
    theme === 'light' ? '#ffffff'
    : theme === 'dark' ? '#1a1a1a'
    : theme === 'system' ? 'inherit'
    : '#000000';

  const textColor =
    theme === 'light' ? '#111827'
    : theme === 'dark' ? '#f3f4f6'
    : theme === 'system' ? 'inherit'
    : '#ffffff';

  const borderColor =
    theme === 'light' ? '#e5e7eb'
    : theme === 'dark' ? '#374151'
    : theme === 'system' ? 'inherit'
    : '#ffffff';

  return { backgroundColor, textColor, borderColor };
}
