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

  const fontFamily =
    theme === 'light' ? 'Inter, system-ui, sans-serif'
    : theme === 'dark' ? 'Inter, system-ui, sans-serif'
    : theme === 'system' ? 'inherit'
    : 'Arial, sans-serif';

  return { backgroundColor, textColor, borderColor, fontFamily };
}
