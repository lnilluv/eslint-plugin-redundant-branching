// Existing code in project — sync status display component

type SyncStatus = 'blocked' | 'offline' | 'syncing' | 'synced';

export function getSyncDisplay(syncStatus: SyncStatus) {
  const syncTitle =
    syncStatus === 'blocked' ? 'Client sync blocked'
    : syncStatus === 'offline' ? 'Client sync offline'
    : syncStatus === 'syncing' ? 'Client sync in progress'
    : 'Client sync healthy';

  return { syncTitle };
}
