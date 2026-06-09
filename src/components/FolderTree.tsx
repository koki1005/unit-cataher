'use client'

import { useState, useEffect } from 'react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Link, Trash2, Pencil, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'
import { Folder as FolderType, UrlItem } from '@/lib/types'
import {
  deleteFolder, renameFolder, deleteUrl, renameUrl,
  setFolderBackground, setUrlBackground,
  getFolders, getUrls,
} from '@/lib/storage'
import {
  deleteFolderRemote, renameFolderRemote, deleteUrlRemote, renameUrlRemote,
  setFolderBackgroundRemote, setUrlBackgroundRemote,
} from '@/lib/supabase-storage'
import EditItemDialog from './EditItemDialog'
import { cn } from '@/lib/utils'

export function useIsPcViewport() {
  const [isPc, setIsPc] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setIsPc(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isPc
}

function bgStyle(url: string | null, fxPhone: number, fyPhone: number, fxPc: number, fyPc: number, isPc: boolean): React.CSSProperties | undefined {
  if (!url) return undefined
  const fx = isPc ? fxPc : fxPhone
  const fy = isPc ? fyPc : fyPhone
  return {
    backgroundImage: `url("${url}")`,
    backgroundPosition: `${fx * 100}% ${fy * 100}%`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
  }
}

const GLASS = 'bg-white/10 backdrop-blur-md backdrop-saturate-150 shadow-lg shadow-black/5'

async function shareItems(items: UrlItem[]) {
  const text = items.map(u => `${u.name}\n${u.url}`).join('\n\n')
  if (navigator.share) {
    try { await navigator.share({ title: 'Unit Catcher', text }) } catch {}
  } else {
    await navigator.clipboard.writeText(text)
    alert('クリップボードにコピーしました')
  }
}

export function buildSortedItems(folders: FolderType[], urls: UrlItem[], parentId: string | null) {
  const childFolders = folders.filter(f => f.parent_id === parentId)
  const childUrls = urls.filter(u => u.folder_id === parentId)
  return [
    ...childFolders.map(f => ({ type: 'folder' as const, item: f, sortId: `folder-${f.id}`, pos: f.position ?? 999999 })),
    ...childUrls.map(u => ({ type: 'url' as const, item: u, sortId: `url-${u.id}`, pos: u.position ?? 999999 })),
  ].sort((a, b) => a.pos - b.pos)
}

// ---- Gap drop zone for move mode ----

function GapDropZone({ containerId, index }: { containerId: string | null; index: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `gap-${containerId ?? 'root'}-${index}`,
    data: { type: 'gap', containerId, index },
  })
  return (
    <div ref={setNodeRef} className="h-4 flex items-center px-2">
      <div className={cn(
        'w-full rounded-full transition-all duration-150',
        isOver ? 'h-1 bg-primary shadow-sm' : 'h-px bg-transparent'
      )} />
    </div>
  )
}

// ---- Sort mode components (useSortable) ----

type EditSaveData = { name: string; bg_image_url: string | null; bg_focal_x: number; bg_focal_y: number; bg_focal_x_pc: number; bg_focal_y_pc: number }

function SortableUrl({ item }: { item: UrlItem }) {
  const { user, setUrls, reload, selectMode, selectedIds, toggleSelect } = useApp()
  const [editing, setEditing] = useState(false)
  const isPc = useIsPcViewport()


  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `url-${item.id}`,
    data: { type: 'url', id: item.id },
    disabled: selectMode,
  })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const isSelected = selectedIds.has(item.id)
  const bg = bgStyle(item.bg_image_url, item.bg_focal_x, item.bg_focal_y, item.bg_focal_x_pc, item.bg_focal_y_pc, isPc)

  const handleDelete = async () => {
    if (!confirm(`「${item.name}」を削除しますか？`)) return
    if (user) { await deleteUrlRemote(item.id); reload() }
    else { deleteUrl(item.id); setUrls(getUrls()) }
  }

  const handleEditSave = async ({ name, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc }: EditSaveData) => {
    if (user) {
      if (name !== item.name) await renameUrlRemote(item.id, name)
      await setUrlBackgroundRemote(item.id, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc)
      reload()
    } else {
      if (name !== item.name) renameUrl(item.id, name)
      setUrlBackground(item.id, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc)
      setUrls(getUrls())
    }
    setEditing(false)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ ...style, ...(bg ?? {}) }}
        className={cn(
          'relative flex items-center gap-2 py-4 px-3 rounded-xl border-[3px] border-blue-600/60 group mb-1.5 overflow-hidden',
          !bg && GLASS,
          isDragging && 'opacity-40',
          isSelected && 'bg-primary/20'
        )}
      >
        {selectMode ? (
          <button onClick={() => toggleSelect(item.id)} className="relative z-10 flex items-center gap-1.5 flex-1 min-w-0">
            <input type="checkbox" readOnly checked={isSelected} className="w-5 h-5 shrink-0 accent-primary" />
            <span className={cn(
              "shrink-0 inline-flex items-center justify-center",
              bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full p-1.5 shadow-sm"
            )}>
              <Link className="w-5 h-5 text-blue-500" />
            </span>
            <span className={cn(
              "text-base truncate",
              bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full px-3 py-0.5 shadow-sm"
            )}>{item.name}</span>
          </button>
        ) : (
          <>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.name}
              className="absolute inset-0 z-0 rounded-xl"
            />
            <div {...listeners} {...attributes} className={cn("relative z-10 cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0", bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full ml-0 shadow-sm")}>
              <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
              </svg>
            </div>
            <div className="relative z-10 flex items-center gap-1.5 flex-1 min-w-0 self-stretch pointer-events-none">
              <span className={cn(
              "shrink-0 inline-flex items-center justify-center",
              bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full p-1.5 shadow-sm"
            )}>
              <Link className="w-5 h-5 text-blue-500" />
            </span>
              <span className={cn(
                "text-base truncate",
                bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full px-3 py-0.5 shadow-sm"
              )}>{item.name}</span>
            </div>
            <div className={cn("relative z-10 flex items-center gap-0.5 shrink-0", bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full px-1 shadow-sm")}>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => shareItems([item])}>
                <Share2 className="w-4 h-4" />
              </Button>

              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
      {editing && (
        <EditItemDialog
          open
          scope="url"
          itemId={item.id}
          initialName={item.name}
          initialBgUrl={item.bg_image_url}
          initialFocalX={item.bg_focal_x}
          initialFocalY={item.bg_focal_y}
          initialFocalXPc={item.bg_focal_x_pc}
          initialFocalYPc={item.bg_focal_y_pc}
          onClose={() => setEditing(false)}
          onSave={handleEditSave}
        />
      )}
    </>
  )
}

function SortableFolder({ folder, depth }: { folder: FolderType; depth: number }) {
  const { user, folders, urls, setFolders, setUrls, reload, selectMode, selectedIds, toggleSelect } = useApp()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const isPc = useIsPcViewport()


  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', id: folder.id },
    disabled: selectMode,
  })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const isSelected = selectedIds.has(folder.id)
  const bg = bgStyle(folder.bg_image_url, folder.bg_focal_x, folder.bg_focal_y, folder.bg_focal_x_pc, folder.bg_focal_y_pc, isPc)

  const handleDelete = async () => {
    if (!confirm(`「${folder.name}」を削除しますか？中のURLも全て削除されます。`)) return
    if (user) { await deleteFolderRemote(folder.id, folders); reload() }
    else { deleteFolder(folder.id); setFolders(getFolders()); setUrls(getUrls()) }
  }

  const handleEditSave = async ({ name, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc }: EditSaveData) => {
    if (user) {
      if (name !== folder.name) await renameFolderRemote(folder.id, name)
      await setFolderBackgroundRemote(folder.id, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc)
      reload()
    } else {
      if (name !== folder.name) renameFolder(folder.id, name)
      setFolderBackground(folder.id, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc)
      setFolders(getFolders())
    }
    setEditing(false)
  }

  const handleShare = () => {
    const collected: UrlItem[] = []
    const queue = [folder.id]
    while (queue.length > 0) {
      const fid = queue.shift()!
      urls.filter(u => u.folder_id === fid).forEach(u => collected.push(u))
      folders.filter(f => f.parent_id === fid).forEach(f => queue.push(f.id))
    }
    shareItems(collected)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn('rounded-lg transition-colors mb-1.5', isDragging && 'opacity-40', isSelected && 'bg-primary/10')}
      >
        <div
          className={cn(
            'relative flex items-center gap-2 py-4 px-3 group border-[3px] border-zinc-700/70 rounded-xl overflow-hidden',
            !bg && GLASS
          )}
          style={bg ?? undefined}
        >
            {selectMode ? (
            <button onClick={() => toggleSelect(folder.id)} className="relative z-10 flex items-center gap-1.5 flex-1 min-w-0">
              <input type="checkbox" readOnly checked={isSelected} className="w-5 h-5 shrink-0 accent-primary" />
              <span className={cn(
                "shrink-0 inline-flex items-center justify-center",
                bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full p-1.5 shadow-sm"
              )}>
                {open ? <FolderOpen className="w-5 h-5 text-yellow-500" /> : <Folder className="w-5 h-5 text-yellow-500" />}
              </span>
              <span className={cn(
                "text-base font-medium truncate",
                bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full px-3 py-0.5 shadow-sm"
              )}>{folder.name}</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setOpen(p => !p)}
                aria-label={folder.name}
                className="absolute inset-0 z-0 rounded-xl"
              />
              <div {...listeners} {...attributes} className={cn("relative z-10 cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0", bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full ml-0 shadow-sm")}>
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                  <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                  <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                  <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
                </svg>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 flex-1 min-w-0 self-stretch pointer-events-none">
                <span className={cn(
                  "shrink-0 inline-flex items-center justify-center",
                  bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full p-1 shadow-sm"
                )}>
                  {open ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                </span>
                <span className={cn(
                "shrink-0 inline-flex items-center justify-center",
                bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full p-1.5 shadow-sm"
              )}>
                {open ? <FolderOpen className="w-5 h-5 text-yellow-500" /> : <Folder className="w-5 h-5 text-yellow-500" />}
              </span>
                <span className={cn(
                "text-base font-medium truncate",
                bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full px-3 py-0.5 shadow-sm"
              )}>{folder.name}</span>
              </div>
              <div className={cn("relative z-10 flex items-center gap-0.5 shrink-0", bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full px-1 shadow-sm")}>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleShare}>
                  <Share2 className="w-4 h-4" />
                </Button>

                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(true)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
        {open && <FolderTree parentId={folder.id} depth={depth + 1} />}
      </div>
      {editing && (
        <EditItemDialog
          open
          scope="folder"
          itemId={folder.id}
          initialName={folder.name}
          initialBgUrl={folder.bg_image_url}
          initialFocalX={folder.bg_focal_x}
          initialFocalY={folder.bg_focal_y}
          initialFocalXPc={folder.bg_focal_x_pc}
          initialFocalYPc={folder.bg_focal_y_pc}
          onClose={() => setEditing(false)}
          onSave={handleEditSave}
        />
      )}
    </>
  )
}

// ---- Move mode components (useDraggable, gap drop zones) ----

function DraggableUrl({ item }: { item: UrlItem }) {
  const { user, setUrls, reload, selectMode, selectedIds, toggleSelect } = useApp()
  const [editing, setEditing] = useState(false)
  const isPc = useIsPcViewport()


  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `url-${item.id}`,
    data: { type: 'url', id: item.id, folder_id: item.folder_id },
    disabled: selectMode,
  })

  const isSelected = selectedIds.has(item.id)
  const bg = bgStyle(item.bg_image_url, item.bg_focal_x, item.bg_focal_y, item.bg_focal_x_pc, item.bg_focal_y_pc, isPc)

  const handleDelete = async () => {
    if (!confirm(`「${item.name}」を削除しますか？`)) return
    if (user) { await deleteUrlRemote(item.id); reload() }
    else { deleteUrl(item.id); setUrls(getUrls()) }
  }

  const handleEditSave = async ({ name, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc }: EditSaveData) => {
    if (user) {
      if (name !== item.name) await renameUrlRemote(item.id, name)
      await setUrlBackgroundRemote(item.id, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc)
      reload()
    } else {
      if (name !== item.name) renameUrl(item.id, name)
      setUrlBackground(item.id, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc)
      setUrls(getUrls())
    }
    setEditing(false)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={bg ?? undefined}
        className={cn(
          'relative flex items-center gap-2 py-4 px-3 rounded-xl border-[3px] border-blue-600/60 group mb-1.5 overflow-hidden',
          !bg && GLASS,
          isDragging && 'opacity-40',
          isSelected && 'bg-primary/20'
        )}
      >
        {selectMode ? (
          <button onClick={() => toggleSelect(item.id)} className="flex items-center gap-1.5 flex-1 min-w-0">
            <input type="checkbox" readOnly checked={isSelected} className="w-5 h-5 shrink-0 accent-primary" />
            <span className={cn(
              "shrink-0 inline-flex items-center justify-center",
              bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full p-1.5 shadow-sm"
            )}>
              <Link className="w-5 h-5 text-blue-500" />
            </span>
            <span className={cn(
              "text-base truncate",
              bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full px-3 py-0.5 shadow-sm"
            )}>{item.name}</span>
          </button>
        ) : (
          <>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.name}
              className="absolute inset-0 z-0 rounded-xl"
            />
            <div {...listeners} {...attributes} className={cn("relative z-10 cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0", bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full ml-0 shadow-sm")}>
              <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
              </svg>
            </div>
            <div className="relative z-10 flex items-center gap-1.5 flex-1 min-w-0 self-stretch pointer-events-none">
              <span className={cn(
              "shrink-0 inline-flex items-center justify-center",
              bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full p-1.5 shadow-sm"
            )}>
              <Link className="w-5 h-5 text-blue-500" />
            </span>
              <span className={cn(
                "text-base truncate",
                bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full px-3 py-0.5 shadow-sm"
              )}>{item.name}</span>
            </div>
            <div className={cn("relative z-10 flex items-center gap-0.5 shrink-0", bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full px-1 shadow-sm")}>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => shareItems([item])}>
                <Share2 className="w-4 h-4" />
              </Button>

              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
      {editing && (
        <EditItemDialog
          open
          scope="url"
          itemId={item.id}
          initialName={item.name}
          initialBgUrl={item.bg_image_url}
          initialFocalX={item.bg_focal_x}
          initialFocalY={item.bg_focal_y}
          initialFocalXPc={item.bg_focal_x_pc}
          initialFocalYPc={item.bg_focal_y_pc}
          onClose={() => setEditing(false)}
          onSave={handleEditSave}
        />
      )}
    </>
  )
}

function DraggableFolder({ folder, depth }: { folder: FolderType; depth: number }) {
  const { user, folders, urls, setFolders, setUrls, reload, selectMode, selectedIds, toggleSelect } = useApp()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const isPc = useIsPcViewport()


  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', id: folder.id, parent_id: folder.parent_id },
    disabled: selectMode,
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-folder-${folder.id}`,
    data: { type: 'folder', id: folder.id },
  })

  const setNodeRef = (node: HTMLElement | null) => { setDragRef(node); setDropRef(node) }
  const isSelected = selectedIds.has(folder.id)
  const bg = bgStyle(folder.bg_image_url, folder.bg_focal_x, folder.bg_focal_y, folder.bg_focal_x_pc, folder.bg_focal_y_pc, isPc)

  const handleDelete = async () => {
    if (!confirm(`「${folder.name}」を削除しますか？中のURLも全て削除されます。`)) return
    if (user) { await deleteFolderRemote(folder.id, folders); reload() }
    else { deleteFolder(folder.id); setFolders(getFolders()); setUrls(getUrls()) }
  }

  const handleEditSave = async ({ name, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc }: EditSaveData) => {
    if (user) {
      if (name !== folder.name) await renameFolderRemote(folder.id, name)
      await setFolderBackgroundRemote(folder.id, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc)
      reload()
    } else {
      if (name !== folder.name) renameFolder(folder.id, name)
      setFolderBackground(folder.id, bg_image_url, bg_focal_x, bg_focal_y, bg_focal_x_pc, bg_focal_y_pc)
      setFolders(getFolders())
    }
    setEditing(false)
  }

  const handleShare = () => {
    const collected: UrlItem[] = []
    const queue = [folder.id]
    while (queue.length > 0) {
      const fid = queue.shift()!
      urls.filter(u => u.folder_id === fid).forEach(u => collected.push(u))
      folders.filter(f => f.parent_id === fid).forEach(f => queue.push(f.id))
    }
    shareItems(collected)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn('rounded-xl transition-colors mb-1.5', isDragging && 'opacity-40', isSelected && 'bg-primary/10')}
      >
        <div
          className={cn(
            'relative flex items-center gap-2 py-4 px-3 group border-[3px] rounded-xl transition-colors overflow-hidden',
            isOver ? 'border-primary bg-primary/20' : 'border-zinc-700/70',
            !bg && GLASS
          )}
          style={bg ?? undefined}
        >
            {selectMode ? (
            <button onClick={() => toggleSelect(folder.id)} className="relative z-10 flex items-center gap-1.5 flex-1 min-w-0">
              <input type="checkbox" readOnly checked={isSelected} className="w-5 h-5 shrink-0 accent-primary" />
              <span className={cn(
                "shrink-0 inline-flex items-center justify-center",
                bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full p-1.5 shadow-sm"
              )}>
                {open ? <FolderOpen className="w-5 h-5 text-yellow-500" /> : <Folder className="w-5 h-5 text-yellow-500" />}
              </span>
              <span className={cn(
                "text-base font-medium truncate",
                bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full px-3 py-0.5 shadow-sm"
              )}>{folder.name}</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setOpen(p => !p)}
                aria-label={folder.name}
                className="absolute inset-0 z-0 rounded-xl"
              />
              <div {...listeners} {...attributes} className={cn("relative z-10 cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0", bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full ml-0 shadow-sm")}>
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                  <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                  <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                  <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
                </svg>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 flex-1 min-w-0 self-stretch pointer-events-none">
                <span className={cn(
                  "shrink-0 inline-flex items-center justify-center",
                  bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full p-1 shadow-sm"
                )}>
                  {open ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                </span>
                <span className={cn(
                "shrink-0 inline-flex items-center justify-center",
                bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full p-1.5 shadow-sm"
              )}>
                {open ? <FolderOpen className="w-5 h-5 text-yellow-500" /> : <Folder className="w-5 h-5 text-yellow-500" />}
              </span>
                <span className={cn(
                "text-base font-medium truncate",
                bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full px-3 py-0.5 shadow-sm"
              )}>{folder.name}</span>
              </div>
              <div className={cn("relative z-10 flex items-center gap-0.5 shrink-0", bg && "bg-white/25 backdrop-blur-md backdrop-saturate-150 rounded-full px-1 shadow-sm")}>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleShare}>
                  <Share2 className="w-4 h-4" />
                </Button>

                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(true)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
        {open && <FolderTree parentId={folder.id} depth={depth + 1} />}
      </div>
      {editing && (
        <EditItemDialog
          open
          scope="folder"
          itemId={folder.id}
          initialName={folder.name}
          initialBgUrl={folder.bg_image_url}
          initialFocalX={folder.bg_focal_x}
          initialFocalY={folder.bg_focal_y}
          initialFocalXPc={folder.bg_focal_x_pc}
          initialFocalYPc={folder.bg_focal_y_pc}
          onClose={() => setEditing(false)}
          onSave={handleEditSave}
        />
      )}
    </>
  )
}

// ---- FolderTree ----

type Props = { parentId: string | null; depth?: number }

export default function FolderTree({ parentId, depth = 0 }: Props) {
  const { folders, urls, moveMode } = useApp()
  const items = buildSortedItems(folders, urls, parentId)
  const sortableIds = items.map(i => i.sortId)
  const indent = depth > 0 ? 'ml-4 border-l border-border pl-2' : ''

  if (moveMode) {
    return (
      <div className={indent}>
        <GapDropZone containerId={parentId} index={0} />
        {items.map(({ type, item }, i) => (
          <div key={item.id}>
            {type === 'folder'
              ? <DraggableFolder folder={item as FolderType} depth={depth} />
              : <DraggableUrl item={item as UrlItem} />
            }
            <GapDropZone containerId={parentId} index={i + 1} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
      <div className={indent}>
        {items.map(({ type, item }) =>
          type === 'folder'
            ? <SortableFolder key={item.id} folder={item as FolderType} depth={depth} />
            : <SortableUrl key={item.id} item={item as UrlItem} />
        )}
      </div>
    </SortableContext>
  )
}
