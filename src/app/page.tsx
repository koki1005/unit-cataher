'use client'

import { useState, useCallback } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  MouseSensor, TouchSensor, useSensor, useSensors, useDroppable,
  closestCenter, ClientRect,
} from '@dnd-kit/core'
import type { CollisionDetection } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Plus, FolderPlus, UserCircle2, Link2, CheckSquare, X, Share2, Trash2 } from 'lucide-react'
import FolderTree, { buildSortedItems } from '@/components/FolderTree'
import AddSheet from '@/components/AddSheet'
import CreateFolderDialog from '@/components/CreateFolderDialog'
import AccountSheet from '@/components/AccountSheet'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'
import { moveUrl, moveFolder, getFolders, getUrls, deleteUrls, deleteFolders, reorderItems } from '@/lib/storage'
import { moveUrlRemote, moveFolderRemote, deleteUrlsRemote, deleteFoldersRemote, reorderItemsRemote } from '@/lib/supabase-storage'
import { Folder, UrlItem } from '@/lib/types'

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-root', data: { type: 'root' } })
  return (
    <div ref={setNodeRef} className={`min-h-[60px] rounded-lg mt-1 transition-colors ${isOver ? 'bg-primary/10 ring-2 ring-primary/30' : ''}`} />
  )
}

function DragOverlayItem({ id, folders, urls }: { id: string; folders: Folder[]; urls: UrlItem[] }) {
  const isFolder = id.startsWith('folder-')
  const itemId = id.replace(/^(folder|url)-/, '')
  const label = isFolder ? folders.find(f => f.id === itemId)?.name : urls.find(u => u.id === itemId)?.name
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border shadow-lg text-sm font-medium opacity-90">
      {isFolder ? '📁' : '🔗'} {label}
    </div>
  )
}

// Returns true if point is within rect
function inRect(rect: ClientRect, x: number, y: number) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

export default function HomePage() {
  const {
    user, folders, urls, setFolders, setUrls, reload,
    selectMode, setSelectMode, selectedIds, clearSelection,
    setPendingDropFolderId,
  } = useApp()

  const [addOpen, setAddOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const isEmpty = folders.length === 0 && urls.length === 0

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } })
  )

  // Center 40% of folder row → drop into folder, edges → reorder (closestCenter)
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const { active, droppableContainers, droppableRects, pointerCoordinates } = args

    if (pointerCoordinates) {
      for (const container of droppableContainers) {
        const id = String(container.id)
        if (!id.startsWith('folder-')) continue
        if (id === String(active.id)) continue

        const rect = droppableRects.get(container.id)
        if (!rect) continue

        if (inRect(rect, pointerCoordinates.x, pointerCoordinates.y)) {
          const relY = (pointerCoordinates.y - rect.top) / rect.height
          if (relY >= 0.3 && relY <= 0.7) {
            const folderId = id.replace('folder-', '')
            const dropContainer = droppableContainers.find(c => c.id === `drop-folder-${folderId}`)
            if (dropContainer) return [{ id: dropContainer.id, data: dropContainer }]
          }
        }
      }
    }

    return closestCenter(args)
  }, [])

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingId(String(e.active.id))
    setPendingDropFolderId(null)
  }

  const handleDragOver = (e: DragOverEvent) => {
    const overId = String(e.over?.id ?? '')
    setPendingDropFolderId(overId.startsWith('drop-folder-') ? overId.replace('drop-folder-', '') : null)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setDraggingId(null)
    setPendingDropFolderId(null)

    const { active, over } = e
    if (!over) return

    const overId = String(over.id)
    const activeData = active.data.current as { type: string; id: string }

    // --- Case 1: Drop INTO folder ---
    if (overId.startsWith('drop-folder-')) {
      const folderId = overId.replace('drop-folder-', '')
      const isDescendant = (checkId: string, targetId: string): boolean => {
        if (checkId === targetId) return true
        return folders.filter(f => f.parent_id === checkId).some(f => isDescendant(f.id, targetId))
      }
      if (activeData.type === 'url') {
        const url = urls.find(u => u.id === activeData.id)
        if (!url || url.folder_id === folderId) return
        const newPos = urls.filter(u => u.folder_id === folderId).reduce((m, u) => Math.max(m, u.position ?? -1), -1) + 1
        setUrls(urls.map(u => u.id === activeData.id ? { ...u, folder_id: folderId, position: newPos } : u))
        if (user) moveUrlRemote(activeData.id, folderId, newPos).catch(() => reload())
        else { moveUrl(activeData.id, folderId, newPos) }
      } else {
        if (isDescendant(activeData.id, folderId)) return
        const folder = folders.find(f => f.id === activeData.id)
        if (!folder || folder.parent_id === folderId) return
        const newPos = folders.filter(f => f.parent_id === folderId).reduce((m, f) => Math.max(m, f.position ?? -1), -1) + 1
        setFolders(folders.map(f => f.id === activeData.id ? { ...f, parent_id: folderId, position: newPos } : f))
        if (user) moveFolderRemote(activeData.id, folderId, newPos).catch(() => reload())
        else { moveFolder(activeData.id, folderId, newPos) }
      }
      return
    }

    // --- Case 2: Drop on root zone ---
    if (overId === 'drop-root') {
      if (activeData.type === 'url') {
        const url = urls.find(u => u.id === activeData.id)
        if (!url || url.folder_id === null) return
        const newPos = urls.filter(u => u.folder_id === null).reduce((m, u) => Math.max(m, u.position ?? -1), -1) + 1
        setUrls(urls.map(u => u.id === activeData.id ? { ...u, folder_id: null, position: newPos } : u))
        if (user) moveUrlRemote(activeData.id, null, newPos).catch(() => reload())
        else { moveUrl(activeData.id, null, newPos) }
      } else {
        const folder = folders.find(f => f.id === activeData.id)
        if (!folder || folder.parent_id === null) return
        const newPos = folders.filter(f => f.parent_id === null).reduce((m, f) => Math.max(m, f.position ?? -1), -1) + 1
        setFolders(folders.map(f => f.id === activeData.id ? { ...f, parent_id: null, position: newPos } : f))
        if (user) moveFolderRemote(activeData.id, null, newPos).catch(() => reload())
        else { moveFolder(activeData.id, null, newPos) }
      }
      return
    }

    // --- Case 3: Reorder ---
    if (active.id === over.id) return

    const activeItem = activeData.type === 'url'
      ? urls.find(u => u.id === activeData.id)
      : folders.find(f => f.id === activeData.id)
    if (!activeItem) return

    const parentId = activeData.type === 'url'
      ? (activeItem as UrlItem).folder_id
      : (activeItem as Folder).parent_id

    const levelItems = buildSortedItems(folders, urls, parentId)
    const oldIndex = levelItems.findIndex(i => i.sortId === String(active.id))
    const newIndex = levelItems.findIndex(i => i.sortId === String(over.id))
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    const reordered = arrayMove(levelItems, oldIndex, newIndex)
    const folderUpdates = reordered.filter(i => i.type === 'folder').map(i => ({ id: i.item.id, position: reordered.indexOf(i) }))
    const urlUpdates = reordered.filter(i => i.type === 'url').map(i => ({ id: i.item.id, position: reordered.indexOf(i) }))

    const posMap = new Map([...folderUpdates, ...urlUpdates].map(u => [u.id, u.position]))
    setFolders(folders.map(f => posMap.has(f.id) ? { ...f, position: posMap.get(f.id)! } : f))
    setUrls(urls.map(u => posMap.has(u.id) ? { ...u, position: posMap.get(u.id)! } : u))

    if (user) {
      reorderItemsRemote(folderUpdates, urlUpdates).catch(() => reload())
    } else {
      reorderItems(folderUpdates, urlUpdates)
    }
  }

  const collectUrlsFromFolders = (folderIds: string[]): string[] => {
    const result: string[] = []
    const queue = [...folderIds]
    const visited = new Set<string>()
    while (queue.length > 0) {
      const fid = queue.shift()!
      if (visited.has(fid)) continue
      visited.add(fid)
      urls.filter(u => u.folder_id === fid).forEach(u => result.push(u.id))
      folders.filter(f => f.parent_id === fid).forEach(f => queue.push(f.id))
    }
    return result
  }

  const handleShare = async () => {
    const selectedArr = Array.from(selectedIds)
    const urlIds = selectedArr.filter(id => urls.some(u => u.id === id))
    const folderIds = selectedArr.filter(id => folders.some(f => f.id === id))
    const extraUrlIds = collectUrlsFromFolders(folderIds)
    const allUrlIds = Array.from(new Set([...urlIds, ...extraUrlIds]))
    const items = allUrlIds.map(id => urls.find(u => u.id === id)).filter(Boolean) as UrlItem[]
    const text = items.map(u => `${u.name}\n${u.url}`).join('\n\n')
    if (navigator.share) {
      await navigator.share({ title: 'Unit Catcher', text })
    } else {
      await navigator.clipboard.writeText(text)
      alert('クリップボードにコピーしました')
    }
  }

  const handleDeleteSelected = async () => {
    if (!confirm('選択したアイテムを削除しますか？')) return
    const selectedArr = Array.from(selectedIds)
    const urlIds = selectedArr.filter(id => urls.some(u => u.id === id))
    const folderIds = selectedArr.filter(id => folders.some(f => f.id === id))
    if (user) {
      if (urlIds.length) await deleteUrlsRemote(urlIds)
      if (folderIds.length) await deleteFoldersRemote(folderIds, folders)
      reload()
    } else {
      if (urlIds.length) deleteUrls(urlIds)
      if (folderIds.length) deleteFolders(folderIds)
      setFolders(getFolders())
      setUrls(getUrls())
    }
    clearSelection()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-lg tracking-tight">Unit Catcher</h1>
          </div>
          <div className="flex items-center gap-2">
            {!isEmpty && (
              <button
                onClick={() => { setSelectMode(!selectMode); if (selectMode) clearSelection() }}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${selectMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                選択
              </button>
            )}
            <button
              onClick={() => setAccountOpen(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserCircle2 className="w-5 h-5" />
              <span className="max-w-[100px] truncate">{user ? user.account_name : 'ゲスト'}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-28">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <Link2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-lg">URLがまだありません</p>
                <p className="text-sm text-muted-foreground mt-1">右下の ＋ ボタンから追加してください</p>
              </div>
            </div>
          ) : (
            <>
              <FolderTree parentId={null} />
              <RootDropZone />
            </>
          )}
        </main>

        {selectMode && (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 bg-background border-t border-border px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{selectedIds.size}件選択中</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare} disabled={selectedIds.size === 0}>
                <Share2 className="w-4 h-4 mr-1" />共有
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={selectedIds.size === 0}>
                <Trash2 className="w-4 h-4 mr-1" />削除
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {!selectMode && (
          <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2 z-20">
            {fabOpen && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-foreground text-background rounded-full px-2.5 py-1 font-medium shadow">フォルダを作成</span>
                  <button onClick={() => { setFolderOpen(true); setFabOpen(false) }} className="w-12 h-12 rounded-full bg-muted shadow-lg flex items-center justify-center hover:bg-muted/80 transition-colors border border-border">
                    <FolderPlus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-foreground text-background rounded-full px-2.5 py-1 font-medium shadow">URLを追加</span>
                  <button onClick={() => { setAddOpen(true); setFabOpen(false) }} className="w-12 h-12 rounded-full bg-muted shadow-lg flex items-center justify-center hover:bg-muted/80 transition-colors border border-border">
                    <Link2 className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
            <button
              onClick={() => setFabOpen(prev => !prev)}
              className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:opacity-90 transition-all"
              style={{ transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        )}

        {fabOpen && <div className="fixed inset-0 z-10 bg-black/20" onClick={() => setFabOpen(false)} />}

        <DragOverlay>
          {draggingId && <DragOverlayItem id={draggingId} folders={folders} urls={urls} />}
        </DragOverlay>
      </div>

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <CreateFolderDialog open={folderOpen} onClose={() => setFolderOpen(false)} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </DndContext>
  )
}
