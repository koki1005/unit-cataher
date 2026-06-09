'use client'

import { useState } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent,
  MouseSensor, TouchSensor, useSensor, useSensors,
  closestCenter, pointerWithin,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Plus, FolderPlus, UserCircle2, Link2, CheckSquare, X, Share2, Trash2, ArrowUpDown, FolderInput, Image as ImageIcon } from 'lucide-react'
import FolderTree, { buildSortedItems, useIsPcViewport } from '@/components/FolderTree'
import AddSheet from '@/components/AddSheet'
import CreateFolderDialog from '@/components/CreateFolderDialog'
import AccountSheet from '@/components/AccountSheet'
import PasswordSetupRequired from '@/components/PasswordSetupRequired'
import GlobalBackgroundDialog from '@/components/GlobalBackgroundDialog'
import AppSkeleton from '@/components/AppSkeleton'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'
import { getFolders, getUrls, deleteUrls, deleteFolders, reorderItems, moveUrl, moveFolder, getGuestBackground } from '@/lib/storage'
import { deleteUrlsRemote, deleteFoldersRemote, reorderItemsRemote, moveUrlRemote, moveFolderRemote } from '@/lib/supabase-storage'
import { Folder, UrlItem } from '@/lib/types'

export default function HomePage() {
  const {
    user, folders, urls, setFolders, setUrls, reload,
    selectMode, setSelectMode, selectedIds, clearSelection,
    moveMode, setMoveMode, bgVersion,
    isHydrating,
  } = useApp()

  const isPc = useIsPcViewport()
  const globalBg = user
    ? { url: user.bg_image_url, fx: isPc ? user.bg_focal_x_pc : user.bg_focal_x, fy: isPc ? user.bg_focal_y_pc : user.bg_focal_y }
    : (() => { const g = getGuestBackground(); return { url: g.url, fx: isPc ? g.focal_x_pc : g.focal_x, fy: isPc ? g.focal_y_pc : g.focal_y } })()
  void bgVersion // re-render trigger for guest bg updates

  const [addOpen, setAddOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [bgOpen, setBgOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)

  const isEmpty = folders.length === 0 && urls.length === 0

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  )

  if (user && !user.has_password) {
    return <PasswordSetupRequired />
  }

  if (isHydrating) {
    return <AppSkeleton />
  }

  // ---- Sort mode handlers ----

  const handleSortDragOver = (e: DragOverEvent) => {
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

  const handleSortDragEnd = (e: DragEndEvent) => {
    const { active } = e
    if (!active) return

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

  // ---- Move mode handler ----

  const handleMoveDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over) return

    const activeData = active.data.current as { type: 'url' | 'folder'; id: string; folder_id?: string | null; parent_id?: string | null }
    const overData = over.data.current as { type: string; containerId?: string | null; index?: number; id?: string }

    if (overData.type !== 'gap' && overData.type !== 'folder') return

    // フォルダへ直接ドロップ → そのフォルダの末尾に追加
    if (overData.type === 'folder') {
      const targetFolderId = overData.id ?? null
      const currentContainerId = activeData.type === 'url' ? (activeData.folder_id ?? null) : (activeData.parent_id ?? null)
      if (targetFolderId === currentContainerId) return
      if (!activeData.type || (activeData.type === 'folder' && targetFolderId !== null)) {
        const isDescendant = (checkId: string, target: string): boolean => {
          if (checkId === target) return true
          return folders.filter(f => f.parent_id === checkId).some(f => isDescendant(f.id, target))
        }
        if (activeData.type === 'folder' && isDescendant(activeData.id, targetFolderId!)) return
      }
      const isUrl = activeData.type === 'url'
      const newPos = isUrl
        ? urls.filter(u => u.folder_id === targetFolderId).reduce((m, u) => Math.max(m, u.position ?? -1), -1) + 1
        : folders.filter(f => f.parent_id === targetFolderId && f.id !== activeData.id).reduce((m, f) => Math.max(m, f.position ?? -1), -1) + 1
      if (isUrl) {
        setUrls(urls.map(u => u.id === activeData.id ? { ...u, folder_id: targetFolderId, position: newPos } : u))
        if (user) moveUrlRemote(activeData.id, targetFolderId, newPos).catch(() => reload())
        else moveUrl(activeData.id, targetFolderId, newPos)
      } else {
        setFolders(folders.map(f => f.id === activeData.id ? { ...f, parent_id: targetFolderId, position: newPos } : f))
        if (user) moveFolderRemote(activeData.id, targetFolderId, newPos).catch(() => reload())
        else moveFolder(activeData.id, targetFolderId, newPos)
      }
      return
    }

    const targetContainerId = overData.containerId ?? null
    const targetIndex = overData.index ?? 0
    const itemId = activeData.id
    const isUrl = activeData.type === 'url'
    const currentContainerId = isUrl ? (activeData.folder_id ?? null) : (activeData.parent_id ?? null)

    // No-op: same effective position
    if (currentContainerId === targetContainerId) {
      const currentItems = buildSortedItems(folders, urls, currentContainerId)
      const currentIdx = currentItems.findIndex(i => i.item.id === itemId)
      if (targetIndex === currentIdx || targetIndex === currentIdx + 1) return
    }

    // Prevent dropping folder into its own descendant
    if (!isUrl && targetContainerId !== null) {
      const isDescendant = (checkId: string, target: string): boolean => {
        if (checkId === target) return true
        return folders.filter(f => f.parent_id === checkId).some(f => isDescendant(f.id, target))
      }
      if (isDescendant(itemId, targetContainerId)) return
    }

    // Build target container items without the dragged item
    const filteredFolders = isUrl ? folders : folders.filter(f => f.id !== itemId)
    const filteredUrls = isUrl ? urls.filter(u => u.id !== itemId) : urls
    const targetItems = buildSortedItems(filteredFolders, filteredUrls, targetContainerId)

    // Insert dragged item at target index
    const draggedItem = isUrl
      ? { type: 'url' as const, item: urls.find(u => u.id === itemId)!, sortId: `url-${itemId}`, pos: 0 }
      : { type: 'folder' as const, item: folders.find(f => f.id === itemId)!, sortId: `folder-${itemId}`, pos: 0 }
    targetItems.splice(targetIndex, 0, draggedItem)

    // Build position maps
    const urlPositions: { id: string; position: number }[] = []
    const folderPositions: { id: string; position: number }[] = []

    targetItems.forEach((item, i) => {
      if (item.type === 'url') urlPositions.push({ id: item.item.id, position: i })
      else folderPositions.push({ id: item.item.id, position: i })
    })

    // If cross-container, also recalculate source container positions
    if (currentContainerId !== targetContainerId) {
      const sourceItems = buildSortedItems(filteredFolders, filteredUrls, currentContainerId)
      sourceItems.forEach((item, i) => {
        if (item.type === 'url') urlPositions.push({ id: item.item.id, position: i })
        else folderPositions.push({ id: item.item.id, position: i })
      })
    }

    const urlPosMap = new Map(urlPositions.map(u => [u.id, u.position]))
    const folderPosMap = new Map(folderPositions.map(f => [f.id, f.position]))

    // Apply optimistic state
    setUrls(urls.map(u => {
      if (isUrl && u.id === itemId) return { ...u, folder_id: targetContainerId, position: urlPosMap.get(u.id) ?? u.position }
      const pos = urlPosMap.get(u.id)
      return pos !== undefined ? { ...u, position: pos } : u
    }))
    setFolders(folders.map(f => {
      if (!isUrl && f.id === itemId) return { ...f, parent_id: targetContainerId, position: folderPosMap.get(f.id) ?? f.position }
      const pos = folderPosMap.get(f.id)
      return pos !== undefined ? { ...f, position: pos } : f
    }))

    // Save to storage
    const movedItemPos = isUrl ? urlPosMap.get(itemId) : folderPosMap.get(itemId)
    const folderReorders = folderPositions.filter(f => !(!isUrl && f.id === itemId))
    const urlReorders = urlPositions.filter(u => !(isUrl && u.id === itemId))

    if (user) {
      const itemSave = isUrl
        ? moveUrlRemote(itemId, targetContainerId, movedItemPos)
        : moveFolderRemote(itemId, targetContainerId, movedItemPos)
      Promise.all([itemSave, reorderItemsRemote(folderReorders, urlReorders)]).catch(() => reload())
    } else {
      if (isUrl) moveUrl(itemId, targetContainerId, movedItemPos)
      else moveFolder(itemId, targetContainerId, movedItemPos)
      reorderItems(folderReorders, urlReorders)
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
      collisionDetection={moveMode ? pointerWithin : closestCenter}
      onDragOver={moveMode ? undefined : handleSortDragOver}
      onDragEnd={moveMode ? handleMoveDragEnd : handleSortDragEnd}
    >
      {globalBg.url && (
        <div
          className="fixed inset-0 -z-10 pointer-events-none"
          style={{
            backgroundImage: `url("${globalBg.url}")`,
            backgroundPosition: `${globalBg.fx * 100}% ${globalBg.fy * 100}%`,
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
      <div className={`min-h-screen flex flex-col max-w-lg mx-auto ${globalBg.url ? '' : 'bg-background'}`}>
        <header className={`sticky top-0 z-10 px-4 py-3 flex items-center justify-between ${globalBg.url ? 'bg-transparent' : 'bg-background/80 backdrop-blur border-b border-border'}`}>
          <div className="flex items-center gap-2 min-w-0 shrink bg-white/10 backdrop-blur-md backdrop-saturate-150 border border-white/20 shadow-sm rounded-full px-3 py-1">
            <Link2 className="w-5 h-5 text-primary shrink-0" />
            <h1 className="font-bold text-lg tracking-tight truncate">Unit Catcher</h1>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isEmpty && (
              <>
                <button
                  onClick={() => { setSelectMode(!selectMode); if (selectMode) clearSelection() }}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors border backdrop-blur-md backdrop-saturate-150 shadow-sm ${selectMode ? 'bg-primary text-primary-foreground border-primary/40' : 'bg-white/10 border-white/20 text-foreground/80 hover:text-foreground hover:bg-white/20'}`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  選択
                </button>
                <button
                  onClick={() => setMoveMode(!moveMode)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors border backdrop-blur-md backdrop-saturate-150 shadow-sm ${moveMode ? 'bg-orange-500 text-white border-orange-400/40' : 'bg-white/10 border-white/20 text-foreground/80 hover:text-foreground hover:bg-white/20'}`}
                >
                  {moveMode ? <FolderInput className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5" />}
                  {moveMode ? '移動中' : '並べ替え'}
                </button>
              </>
            )}
            <button
              onClick={() => setAccountOpen(true)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-white/10 border-white/20 backdrop-blur-md backdrop-saturate-150 shadow-sm text-foreground/80 hover:text-foreground hover:bg-white/20 transition-colors shrink-0"
            >
              <UserCircle2 className="w-4 h-4" />
              <span className="max-w-[60px] truncate hidden sm:inline">{user ? user.account_name : 'ゲスト'}</span>
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
              <Button variant="outline" onClick={handleShare} disabled={selectedIds.size === 0}>
                <Share2 className="w-4 h-4 mr-1.5" />共有
              </Button>
              <Button variant="destructive" onClick={handleDeleteSelected} disabled={selectedIds.size === 0}>
                <Trash2 className="w-4 h-4 mr-1.5" />削除
              </Button>
              <Button variant="ghost" size="icon" onClick={clearSelection}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {!selectMode && (
          <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2 z-20">
            {fabOpen && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-foreground text-background rounded-full px-2.5 py-1 font-medium shadow">背景画像を設定</span>
                  <button onClick={() => { setBgOpen(true); setFabOpen(false) }} className="w-12 h-12 rounded-full bg-muted shadow-lg flex items-center justify-center hover:bg-muted/80 transition-colors border border-border">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                </div>
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
      <GlobalBackgroundDialog open={bgOpen} onClose={() => setBgOpen(false)} />
    </DndContext>
  )
}
