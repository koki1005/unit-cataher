import { Folder, UrlItem } from './types'

const FOLDERS_KEY = 'uc_folders'
const URLS_KEY = 'uc_urls'
const GUEST_BG_KEY = 'uc_guest_bg'

function generateId(): string {
  return crypto.randomUUID()
}

function normalizeFolder(f: Partial<Folder>): Folder {
  return {
    id: f.id!,
    user_id: f.user_id ?? null,
    name: f.name ?? '',
    parent_id: f.parent_id ?? null,
    position: f.position ?? null,
    created_at: f.created_at ?? new Date().toISOString(),
    bg_image_url: f.bg_image_url ?? null,
    bg_focal_x: f.bg_focal_x ?? 0.5,
    bg_focal_y: f.bg_focal_y ?? 0.5,
    bg_focal_x_pc: f.bg_focal_x_pc ?? 0.5,
    bg_focal_y_pc: f.bg_focal_y_pc ?? 0.5,
  }
}

function normalizeUrl(u: Partial<UrlItem>): UrlItem {
  return {
    id: u.id!,
    user_id: u.user_id ?? null,
    folder_id: u.folder_id ?? null,
    name: u.name ?? '',
    url: u.url ?? '',
    position: u.position ?? null,
    created_at: u.created_at ?? new Date().toISOString(),
    bg_image_url: u.bg_image_url ?? null,
    bg_focal_x: u.bg_focal_x ?? 0.5,
    bg_focal_y: u.bg_focal_y ?? 0.5,
    bg_focal_x_pc: u.bg_focal_x_pc ?? 0.5,
    bg_focal_y_pc: u.bg_focal_y_pc ?? 0.5,
  }
}

// Folders
export function getFolders(): Folder[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(FOLDERS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Partial<Folder>[]
    return parsed.map(normalizeFolder)
  } catch {
    return []
  }
}

export function saveFolder(name: string, parent_id: string | null = null): Folder {
  const folders = getFolders()
  const maxPos = folders
    .filter(f => f.parent_id === parent_id)
    .reduce((m, f) => Math.max(m, f.position ?? -1), -1)
  const folder: Folder = normalizeFolder({
    id: generateId(),
    user_id: null,
    name,
    parent_id,
    position: maxPos + 1,
    created_at: new Date().toISOString(),
  })
  folders.push(folder)
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
  return folder
}

export function renameFolder(id: string, name: string): void {
  const folders = getFolders().map(f => (f.id === id ? { ...f, name } : f))
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

export function setFolderBackground(id: string, bg_image_url: string | null, bg_focal_x: number, bg_focal_y: number, bg_focal_x_pc: number, bg_focal_y_pc: number): void {
  const folders = getFolders().map(f => f.id === id ? { ...f, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc } : f)
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

export function deleteFolder(id: string): void {
  const allFolders = getFolders()
  const toDelete = new Set<string>()
  const queue = [id]
  while (queue.length > 0) {
    const current = queue.shift()!
    toDelete.add(current)
    allFolders.filter(f => f.parent_id === current).forEach(f => queue.push(f.id))
  }
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(allFolders.filter(f => !toDelete.has(f.id))))
  const urls = getUrls().filter(u => !toDelete.has(u.folder_id ?? ''))
  localStorage.setItem(URLS_KEY, JSON.stringify(urls))
}

// URLs
export function getUrls(): UrlItem[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(URLS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Partial<UrlItem>[]
    return parsed.map(normalizeUrl)
  } catch {
    return []
  }
}

export function saveUrl(name: string, url: string, folder_id: string | null = null): UrlItem {
  const urls = getUrls()
  const maxPos = urls
    .filter(u => u.folder_id === folder_id)
    .reduce((m, u) => Math.max(m, u.position ?? -1), -1)
  const item: UrlItem = normalizeUrl({
    id: generateId(),
    user_id: null,
    folder_id,
    name,
    url,
    position: maxPos + 1,
    created_at: new Date().toISOString(),
  })
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

export function setUrlBackground(id: string, bg_image_url: string | null, bg_focal_x: number, bg_focal_y: number, bg_focal_x_pc: number, bg_focal_y_pc: number): void {
  const urls = getUrls().map(u => u.id === id ? { ...u, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc } : u)
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

// Guest global background
export type GuestBg = { url: string | null; focal_x: number; focal_y: number; focal_x_pc: number; focal_y_pc: number }

export function getGuestBackground(): GuestBg {
  if (typeof window === 'undefined') return { url: null, focal_x: 0.5, focal_y: 0.5, focal_x_pc: 0.5, focal_y_pc: 0.5 }
  const raw = localStorage.getItem(GUEST_BG_KEY)
  if (!raw) return { url: null, focal_x: 0.5, focal_y: 0.5, focal_x_pc: 0.5, focal_y_pc: 0.5 }
  try {
    const parsed = JSON.parse(raw) as Partial<GuestBg>
    return {
      url: parsed.url ?? null,
      focal_x: parsed.focal_x ?? 0.5,
      focal_y: parsed.focal_y ?? 0.5,
      focal_x_pc: parsed.focal_x_pc ?? 0.5,
      focal_y_pc: parsed.focal_y_pc ?? 0.5,
    }
  } catch {
    return { url: null, focal_x: 0.5, focal_y: 0.5, focal_x_pc: 0.5, focal_y_pc: 0.5 }
  }
}

export function setGuestBackground(bg: GuestBg): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(GUEST_BG_KEY, JSON.stringify(bg))
}
