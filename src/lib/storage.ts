import { Folder, UrlItem } from './types'

const FOLDERS_KEY = 'uc_folders'
const URLS_KEY = 'uc_urls'

function generateId(): string {
  return crypto.randomUUID()
}

// Folders
export function getFolders(): Folder[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(FOLDERS_KEY)
  return raw ? JSON.parse(raw) : []
}

export function saveFolder(name: string, parent_id: string | null = null): Folder {
  const folders = getFolders()
  const maxPos = folders
    .filter(f => f.parent_id === parent_id)
    .reduce((m, f) => Math.max(m, f.position ?? -1), -1)
  const folder: Folder = {
    id: generateId(),
    user_id: null,
    name,
    parent_id,
    position: maxPos + 1,
    created_at: new Date().toISOString(),
  }
  folders.push(folder)
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
  return folder
}

export function renameFolder(id: string, name: string): void {
  const folders = getFolders().map(f => (f.id === id ? { ...f, name } : f))
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

export function deleteFolder(id: string): void {
  const allFolders = getFolders()
  // Collect all descendant folder ids
  const toDelete = new Set<string>()
  const queue = [id]
  while (queue.length > 0) {
    const current = queue.shift()!
    toDelete.add(current)
    allFolders.filter(f => f.parent_id === current).forEach(f => queue.push(f.id))
  }
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(allFolders.filter(f => !toDelete.has(f.id))))
  // Delete urls in those folders
  const urls = getUrls().filter(u => !toDelete.has(u.folder_id ?? ''))
  localStorage.setItem(URLS_KEY, JSON.stringify(urls))
}

// URLs
export function getUrls(): UrlItem[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(URLS_KEY)
  return raw ? JSON.parse(raw) : []
}

export function saveUrl(name: string, url: string, folder_id: string | null = null): UrlItem {
  const urls = getUrls()
  const maxPos = urls
    .filter(u => u.folder_id === folder_id)
    .reduce((m, u) => Math.max(m, u.position ?? -1), -1)
  const item: UrlItem = {
    id: generateId(),
    user_id: null,
    folder_id,
    name,
    url,
    position: maxPos + 1,
    created_at: new Date().toISOString(),
  }
  urls.push(item)
  localStorage.setItem(URLS_KEY, JSON.stringify(urls))
  return item
}

export function deleteUrl(id: string): void {
  const urls = getUrls().filter(u => u.id !== id)
  localStorage.setItem(URLS_KEY, JSON.stringify(urls))
}

export function renameUrl(id: string, name: string): void {
  const urls = getUrls().map(u => (u.id === id ? { ...u, name } : u))
  localStorage.setItem(URLS_KEY, JSON.stringify(urls))
}

export function moveUrl(id: string, folder_id: string | null, position?: number): void {
  const urls = getUrls().map(u => u.id === id ? { ...u, folder_id, ...(position !== undefined ? { position } : {}) } : u)
  localStorage.setItem(URLS_KEY, JSON.stringify(urls))
}

export function moveFolder(id: string, parent_id: string | null, position?: number): void {
  const folders = getFolders().map(f => f.id === id ? { ...f, parent_id, ...(position !== undefined ? { position } : {}) } : f)
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

export function deleteUrls(ids: string[]): void {
  const set = new Set(ids)
  const urls = getUrls().filter(u => !set.has(u.id))
  localStorage.setItem(URLS_KEY, JSON.stringify(urls))
}

export function deleteFolders(ids: string[]): void {
  const allFolders = getFolders()
  const toDelete = new Set<string>()
  for (const id of ids) {
    const queue = [id]
    while (queue.length > 0) {
      const current = queue.shift()!
      toDelete.add(current)
      allFolders.filter(f => f.parent_id === current).forEach(f => queue.push(f.id))
    }
  }
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(allFolders.filter(f => !toDelete.has(f.id))))
  const urls = getUrls().filter(u => !toDelete.has(u.folder_id ?? ''))
  localStorage.setItem(URLS_KEY, JSON.stringify(urls))
}

export function reorderItems(
  folderUpdates: Array<{ id: string; position: number }>,
  urlUpdates: Array<{ id: string; position: number }>
): void {
  const fMap = new Map(folderUpdates.map(u => [u.id, u.position]))
  const uMap = new Map(urlUpdates.map(u => [u.id, u.position]))
  const folders = getFolders().map(f => fMap.has(f.id) ? { ...f, position: fMap.get(f.id)! } : f)
  const urls = getUrls().map(u => uMap.has(u.id) ? { ...u, position: uMap.get(u.id)! } : u)
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
  localStorage.setItem(URLS_KEY, JSON.stringify(urls))
}
