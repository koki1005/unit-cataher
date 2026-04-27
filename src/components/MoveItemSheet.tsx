'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useApp } from '@/lib/store'
import { Folder as FolderIcon, Home } from 'lucide-react'
import { Folder, UrlItem } from '@/lib/types'
import { moveUrl, moveFolder, getUrls, getFolders } from '@/lib/storage'
import { moveUrlRemote, moveFolderRemote } from '@/lib/supabase-storage'

type Props = {
  open: boolean
  onClose: () => void
  item: UrlItem | Folder
  itemType: 'url' | 'folder'
}

function getFolderPath(folders: Folder[], id: string): string {
  const parts: string[] = []
  let current: Folder | undefined = folders.find(f => f.id === id)
  while (current) {
    parts.unshift(current.name)
    current = current.parent_id ? folders.find(f => f.id === current!.parent_id) : undefined
  }
  return parts.join(' / ')
}

function isDescendant(folders: Folder[], checkId: string, targetId: string): boolean {
  if (checkId === targetId) return true
  return folders.filter(f => f.parent_id === checkId).some(f => isDescendant(folders, f.id, targetId))
}

export default function MoveItemSheet({ open, onClose, item, itemType }: Props) {
  const { user, folders, urls, setFolders, setUrls, reload } = useApp()

  const currentParentId = itemType === 'url' ? (item as UrlItem).folder_id : (item as Folder).parent_id

  const availableFolders = folders.filter(f => {
    if (f.id === item.id) return false
    if (f.parent_id === currentParentId && itemType === 'folder') return false // same level exclusion optional
    if (itemType === 'folder' && isDescendant(folders, item.id, f.id)) return false
    return true
  })

  const handleMove = async (targetFolderId: string | null) => {
    if (targetFolderId === currentParentId) { onClose(); return }

    const newPos = targetFolderId === null
      ? urls.filter(u => u.folder_id === null).reduce((m, u) => Math.max(m, u.position ?? -1), -1) + 1
      : urls.filter(u => u.folder_id === targetFolderId).reduce((m, u) => Math.max(m, u.position ?? -1), -1) + 1

    if (itemType === 'url') {
      setUrls(urls.map(u => u.id === item.id ? { ...u, folder_id: targetFolderId, position: newPos } : u))
      if (user) moveUrlRemote(item.id, targetFolderId, newPos).catch(() => reload())
      else moveUrl(item.id, targetFolderId, newPos)
    } else {
      const folderNewPos = targetFolderId === null
        ? folders.filter(f => f.parent_id === null && f.id !== item.id).reduce((m, f) => Math.max(m, f.position ?? -1), -1) + 1
        : folders.filter(f => f.parent_id === targetFolderId && f.id !== item.id).reduce((m, f) => Math.max(m, f.position ?? -1), -1) + 1
      setFolders(folders.map(f => f.id === item.id ? { ...f, parent_id: targetFolderId, position: folderNewPos } : f))
      if (user) moveFolderRemote(item.id, targetFolderId, folderNewPos).catch(() => reload())
      else { moveFolder(item.id, targetFolderId, folderNewPos); setFolders(getFolders()); setUrls(getUrls()) }
    }
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" aria-describedby={undefined} className="max-h-[70vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>移動先を選択</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-1">
          <button
            onClick={() => handleMove(null)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-left transition-colors"
          >
            <Home className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium">ルート（最上位）</span>
            {currentParentId === null && <span className="ml-auto text-xs text-muted-foreground">現在地</span>}
          </button>
          {availableFolders.map(f => (
            <button
              key={f.id}
              onClick={() => handleMove(f.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-left transition-colors"
            >
              <FolderIcon className="w-4 h-4 shrink-0 text-yellow-500" />
              <span className="text-sm truncate">{getFolderPath(folders, f.id)}</span>
              {currentParentId === f.id && <span className="ml-auto text-xs text-muted-foreground shrink-0">現在地</span>}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
