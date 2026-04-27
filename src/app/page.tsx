'use client'

import { useState } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent,
  MouseSensor, TouchSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Plus, FolderPlus, UserCircle2, Link2, CheckSquare, X, Share2, Trash2 } from 'lucide-react'
import FolderTree, { buildSortedItems } from '@/components/FolderTree'
import AddSheet from '@/components/AddSheet'
import CreateFolderDialog from '@/components/CreateFolderDialog'
import AccountSheet from '@/components/AccountSheet'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'
import { getFolders, getUrls, deleteUrls, deleteFolders, reorderItems } from '@/lib/storage'
import { deleteUrlsRemote, deleteFoldersRemote, reorderItemsRemote } from '@/lib/supabase-storage'
import { Folder, UrlItem } from '@/lib/types'

export default function HomePage() {
  const {
    user, folders, urls, setFolders, setUrls, reload,
    selectMode, setSelectMode, selectedIds, clearSelection,
  } = useApp()

  const [addOpen, setAddOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)

  const isEmpty = folders.length === 0 && urls.length === 0

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  )

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const activeData = active.data.current as { type: string; id: string }
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
    const posMap = new Map(reordered.map((item, idx) => [item.item.id, idx]))
    setFolders(folders.map(f => posMap.has(f.id) ? { ...f, position: posMap.get(f.id)! } : f))
    setUrls(urls.map(u => posMap.has(u.id) ? { ...u, position: posMap.get(u.id)! } : u))
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const activeData = active.data.current as { type: string; id: string }
    const activeItem = activeData.type === 'url'
      ? urls.find(u => u.id === activeData.id)
      : folders.find(f => f.id === activeData.id)
    if (!activeItem) return

    const parentId = activeData.type === 'url'
      ? (activeItem as UrlItem).folder_id
      : (activeItem as Folder).parent_id

    const levelItems = buildSortedItems(folders, urls, parentId)
    const folderUpdates = levelItems.filter(i => i.type === 'folder').map(i => ({ id: i.item.id, position: i.pos }))
    const urlUpdates = levelItems.filter(i => i.type === 'url').map(i => ({ id: i.item.id, position: i.pos }))

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
    const allUrlIds = Array.from(new Set([...urlIds, ...collectUrlsFromFolders(folderIds)]))
    const items = allUrlIds.map(id => urls.find(u => u.id === id)).filter(Boolean) as UrlItem[]
    const text = items.map(u => `${u.name}\n${u.url}`).join('\n\n')
    if (navigator.share) {
      try { await navigator.share({ title: 'Unit Catcher', text }) } catch {}
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
      collisionDetection={closestCenter}
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
            <FolderTree parentId={null} />
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
      </div>

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <CreateFolderDialog open={folderOpen} onClose={() => setFolderOpen(false)} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </DndContext>
  )
}
