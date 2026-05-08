'use client'

import { createContext, useContext } from 'react'
import { Folder, UrlItem, User } from './types'

export type AppContextType = {
  user: User | null
  setUser: (u: User | null) => void
  folders: Folder[]
  urls: UrlItem[]
  setFolders: (f: Folder[]) => void
  setUrls: (u: UrlItem[]) => void
  reload: () => void
  // select mode
  selectMode: boolean
  setSelectMode: (v: boolean) => void
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  clearSelection: () => void
  // move mode (drag = folder in/out) vs sort mode (drag = reorder)
  moveMode: boolean
  setMoveMode: (v: boolean) => void
}

export const AppContext = createContext<AppContextType>({
  user: null,
  setUser: () => {},
  folders: [],
  urls: [],
  setFolders: () => {},
  setUrls: () => {},
  reload: () => {},
  selectMode: false,
  setSelectMode: () => {},
  selectedIds: new Set(),
  toggleSelect: () => {},
  clearSelection: () => {},
  moveMode: false,
  setMoveMode: () => {},
})

export function useApp() {
  return useContext(AppContext)
}
