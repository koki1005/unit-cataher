'use client'

import { useState } from 'react'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Link, Trash2, Pencil, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'
import { Folder as FolderType, UrlItem } from '@/lib/types'
import {
  deleteFolder, renameFolder, deleteUrl, renameUrl,
  getFolders, getUrls,
} from '@/lib/storage'
import {
  deleteFolderRemote, renameFolderRemote, deleteUrlRemote, renameUrlRemote,
} from '@/lib/supabase-storage'
import RenameDialog from './RenameDialog'
import { cn } from '@/lib/utils'

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

function SortableUrl({ item }: { item: UrlItem }) {
  const { user, setUrls, reload, selectMode, selectedIds, toggleSelect } = useApp()
  const [renaming, setRenaming] = useState(false)


  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `url-${item.id}`,
    data: { type: 'url', id: item.id },
    disabled: selectMode,
  })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const isSelected = selectedIds.has(item.id)

  const handleDelete = async () => {
    if (!confirm(`「${item.name}」を削除しますか？`)) return
    if (user) { await deleteUrlRemote(item.id); reload() }
    else { deleteUrl(item.id); setUrls(getUrls()) }
  }

  const handleRename = async (name: string) => {
    if (user) { await renameUrlRemote(item.id, name); reload() }
    else { renameUrl(item.id, name); setUrls(getUrls()) }
    setRenaming(false)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'flex items-center gap-2 py-4 px-3 rounded-xl hover:bg-muted border-[3px] border-blue-600 group mb-1.5',
          isDragging && 'opacity-40',
          isSelected && 'bg-primary/10'
        )}
      >
        {selectMode ? (
          <button onClick={() => toggleSelect(item.id)} className="flex items-center gap-1.5 flex-1 min-w-0">
            <input type="checkbox" readOnly checked={isSelected} className="w-5 h-5 shrink-0 accent-primary" />
            <Link className="w-5 h-5 shrink-0 text-blue-500" />
            <span className="text-base truncate">{item.name}</span>
          </button>
        ) : (
          <>
            <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0">
              <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
              </svg>
            </div>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 flex-1 min-w-0 self-stretch">
              <Link className="w-5 h-5 shrink-0 text-blue-500" />
              <span className="text-base truncate">{item.name}</span>
            </a>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => shareItems([item])}>
                <Share2 className="w-4 h-4" />
              </Button>

              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRenaming(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
      {renaming && <RenameDialog open initialName={item.name} onClose={() => setRenaming(false)} onSave={handleRename} />}
    </>
  )
}

function SortableFolder({ folder, depth }: { folder: FolderType; depth: number }) {
  const { user, folders, urls, setFolders, setUrls, reload, selectMode, selectedIds, toggleSelect } = useApp()
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)


  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', id: folder.id },
    disabled: selectMode,
  })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const isSelected = selectedIds.has(folder.id)

  const handleDelete = async () => {
    if (!confirm(`「${folder.name}」を削除しますか？中のURLも全て削除されます。`)) return
    if (user) { await deleteFolderRemote(folder.id, folders); reload() }
    else { deleteFolder(folder.id); setFolders(getFolders()); setUrls(getUrls()) }
  }

  const handleRename = async (name: string) => {
    if (user) { await renameFolderRemote(folder.id, name); reload() }
    else { renameFolder(folder.id, name); setFolders(getFolders()) }
    setRenaming(false)
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
        <div className="flex items-center gap-2 py-4 px-3 group border-[3px] border-zinc-900 rounded-xl">
          {selectMode ? (
            <button onClick={() => toggleSelect(folder.id)} className="flex items-center gap-1.5 flex-1 min-w-0">
              <input type="checkbox" readOnly checked={isSelected} className="w-5 h-5 shrink-0 accent-primary" />
              {open ? <FolderOpen className="w-5 h-5 shrink-0 text-yellow-500" /> : <Folder className="w-5 h-5 shrink-0 text-yellow-500" />}
              <span className="text-base font-medium truncate">{folder.name}</span>
            </button>
          ) : (
            <>
              <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0">
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                  <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                  <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                  <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
                </svg>
              </div>
              <button onClick={() => setOpen(p => !p)} className="flex items-center gap-1.5 flex-1 min-w-0 self-stretch">
                {open ? <ChevronDown className="w-5 h-5 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />}
                {open ? <FolderOpen className="w-5 h-5 shrink-0 text-yellow-500" /> : <Folder className="w-5 h-5 shrink-0 text-yellow-500" />}
                <span className="text-base font-medium truncate">{folder.name}</span>
              </button>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleShare}>
                  <Share2 className="w-3 h-3" />
                </Button>

                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRenaming(true)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={handleDelete}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </>
          )}
        </div>
        {open && <FolderTree parentId={folder.id} depth={depth + 1} />}
      </div>
      {renaming && <RenameDialog open initialName={folder.name} onClose={() => setRenaming(false)} onSave={handleRename} />}
    </>
  )
}

// ---- Move mode components (useDraggable, gap drop zones) ----

function DraggableUrl({ item }: { item: UrlItem }) {
  const { user, setUrls, reload, selectMode, selectedIds, toggleSelect } = useApp()
  const [renaming, setRenaming] = useState(false)


  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `url-${item.id}`,
    data: { type: 'url', id: item.id, folder_id: item.folder_id },
    disabled: selectMode,
  })

  const isSelected = selectedIds.has(item.id)

  const handleDelete = async () => {
    if (!confirm(`「${item.name}」を削除しますか？`)) return
    if (user) { await deleteUrlRemote(item.id); reload() }
    else { deleteUrl(item.id); setUrls(getUrls()) }
  }

  const handleRename = async (name: string) => {
    if (user) { await renameUrlRemote(item.id, name); reload() }
    else { renameUrl(item.id, name); setUrls(getUrls()) }
    setRenaming(false)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          'flex items-center gap-2 py-4 px-3 rounded-xl hover:bg-muted border-[3px] border-blue-600 group mb-1.5',
          isDragging && 'opacity-40',
          isSelected && 'bg-primary/10'
        )}
      >
        {selectMode ? (
          <button onClick={() => toggleSelect(item.id)} className="flex items-center gap-1.5 flex-1 min-w-0">
            <input type="checkbox" readOnly checked={isSelected} className="w-5 h-5 shrink-0 accent-primary" />
            <Link className="w-5 h-5 shrink-0 text-blue-500" />
            <span className="text-base truncate">{item.name}</span>
          </button>
        ) : (
          <>
            <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0">
              <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
              </svg>
            </div>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 flex-1 min-w-0 self-stretch">
              <Link className="w-5 h-5 shrink-0 text-blue-500" />
              <span className="text-base truncate">{item.name}</span>
            </a>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => shareItems([item])}>
                <Share2 className="w-4 h-4" />
              </Button>

              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRenaming(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
      {renaming && <RenameDialog open initialName={item.name} onClose={() => setRenaming(false)} onSave={handleRename} />}
    </>
  )
}

function DraggableFolder({ folder, depth }: { folder: FolderType; depth: number }) {
  const { user, folders, urls, setFolders, setUrls, reload, selectMode, selectedIds, toggleSelect } = useApp()
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)


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

  const handleDelete = async () => {
    if (!confirm(`「${folder.name}」を削除しますか？中のURLも全て削除されます。`)) return
    if (user) { await deleteFolderRemote(folder.id, folders); reload() }
    else { deleteFolder(folder.id); setFolders(getFolders()); setUrls(getUrls()) }
  }

  const handleRename = async (name: string) => {
    if (user) { await renameFolderRemote(folder.id, name); reload() }
    else { renameFolder(folder.id, name); setFolders(getFolders()) }
    setRenaming(false)
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
        <div className={cn('flex items-center gap-2 py-4 px-3 group border-[3px] rounded-xl transition-colors', isOver ? 'border-primary bg-primary/10' : 'border-zinc-900')}>
          {selectMode ? (
            <button onClick={() => toggleSelect(folder.id)} className="flex items-center gap-1.5 flex-1 min-w-0">
              <input type="checkbox" readOnly checked={isSelected} className="w-5 h-5 shrink-0 accent-primary" />
              {open ? <FolderOpen className="w-5 h-5 shrink-0 text-yellow-500" /> : <Folder className="w-5 h-5 shrink-0 text-yellow-500" />}
              <span className="text-base font-medium truncate">{folder.name}</span>
            </button>
          ) : (
            <>
              <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0">
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                  <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                  <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                  <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
                </svg>
              </div>
              <button onClick={() => setOpen(p => !p)} className="flex items-center gap-1.5 flex-1 min-w-0 self-stretch">
                {open ? <ChevronDown className="w-5 h-5 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />}
                {open ? <FolderOpen className="w-5 h-5 shrink-0 text-yellow-500" /> : <Folder className="w-5 h-5 shrink-0 text-yellow-500" />}
                <span className="text-base font-medium truncate">{folder.name}</span>
              </button>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleShare}>
                  <Share2 className="w-3 h-3" />
                </Button>

                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRenaming(true)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={handleDelete}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </>
          )}
        </div>
        {open && <FolderTree parentId={folder.id} depth={depth + 1} />}
      </div>
      {renaming && <RenameDialog open initialName={folder.name} onClose={() => setRenaming(false)} onSave={handleRename} />}
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
