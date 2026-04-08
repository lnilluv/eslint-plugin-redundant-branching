// Existing code in project — sync status display component

type SyncStatus = 'blocked' | 'offline' | 'syncing' | 'synced';

export function getSyncDisplay(syncStatus: SyncStatus) {
  const _syncStatus_LOOKUP = {
  "blocked": { syncTitle: 'Client sync blocked', syncLabel: 'Blocked' },
  "offline": { syncTitle: 'Client sync offline', syncLabel: 'Offline' },
  "syncing": { syncTitle: 'Client sync in progress', syncLabel: 'Syncing' }
};
const _syncStatus_DEFAULT = { syncTitle: 'Client sync healthy', syncLabel: 'Synced' };
const { syncTitle, syncLabel } = _syncStatus_LOOKUP[syncStatus] ?? _syncStatus_DEFAULT;

  return { syncTitle, syncLabel };
}
