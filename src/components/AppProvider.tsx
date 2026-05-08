'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'
import { AppContext } from '@/lib/store'
import { User, Folder, UrlItem } from '@/lib/types'
import { getFolders, getUrls } from '@/lib/storage'
import { getFoldersRemote, getUrlsRemote } from '@/lib/supabase-storage'

const USER_KEY = 'uc_user'

export default function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [urls, setUrls] = useState<UrlItem[]>([])
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [moveMode, setMoveMode] = useState(false)

  const loadData = useCallback(async (u: User | null) => {
    if (u) {
      try {
        const [f, ul] = await Promise.all([getFoldersRemote(u.id), getUrlsRemote(u.id)])
        setFolders(f)
        setUrls(ul)
      } catch (error) {
        console.error('Failed to load remote Unit Catcher data', error)
      }
    } else {
      setFolders(getFolders())
      setUrls(getUrls())
    }
  }, [])

  const setUser = useCallback((u: User | null) => {
    setUserState(u)
    if (u) {
      localStorage.setItem(USER_KEY, JSON.stringify(u))
    } else {
      localStorage.removeItem(USER_KEY)
    }
    loadData(u)
  }, [loadData])

  useEffect(() => {
    const raw = localStorage.getItem(USER_KEY)
    const u: User | null = raw ? JSON.parse(raw) : null
    setUserState(u)
    loadData(u)
  }, [loadData])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setSelectMode(false)
  }, [])

  return (
    <AppContext.Provider value={{
      user, setUser, folders, urls, setFolders, setUrls,
      reload: () => loadData(user),
      selectMode, setSelectMode,
      selectedIds, toggleSelect, clearSelection,
      moveMode, setMoveMode,
    }}>
      {children}
    </AppContext.Provider>
  )
}
