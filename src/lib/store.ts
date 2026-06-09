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
  // guest bg refresh trigger
  bgVersion: number
  bumpBgVersion: () => void
  // loading flag
  isHydrating: boolean
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
  bgVersion: 0,
  bumpBgVersion: () => {},
  isHydrating: true,
})

export function useApp() {
  return useContext(AppContext)
}
