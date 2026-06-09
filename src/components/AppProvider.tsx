'use client'

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { AppContext } from '@/lib/store'
import { User, Folder, UrlItem } from '@/lib/types'
import { getFolders, getUrls } from '@/lib/storage'
import { getFoldersRemote, getUrlsRemote } from '@/lib/supabase-storage'

const USER_KEY = 'uc_user'
const foldersCacheKey = (uid: string) => `uc_folders_${uid}`
const urlsCacheKey = (uid: string) => `uc_urls_${uid}`

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeCache(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

export default function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [urls, setUrls] = useState<UrlItem[]>([])
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [moveMode, setMoveMode] = useState(false)
  const [bgVersion, setBgVersion] = useState(0)
  const [isHydrating, setIsHydrating] = useState(true)
  const hydratedUserIdRef = useRef<string | null>(null)
  const initialLoadDoneRef = useRef(false)

  const loadData = useCallback(async (u: User | null) => {
    const start = Date.now()
    const finish = async () => {
      if (!initialLoadDoneRef.current) {
        const elapsed = Date.now() - start
        const remaining = 1000 - elapsed
        if (remaining > 0) await new Promise(r => setTimeout(r, remaining))
        initialLoadDoneRef.current = true
      }
      setIsHydrating(false)
    }

    if (!u) {
      hydratedUserIdRef.current = null
      setFolders(getFolders())
      setUrls(getUrls())
      await finish()
      return
    }

    const cachedFolders = readCache<Folder[]>(foldersCacheKey(u.id))
    const cachedUrls = readCache<UrlItem[]>(urlsCacheKey(u.id))
    if (cachedFolders) setFolders(cachedFolders)
    if (cachedUrls) setUrls(cachedUrls)
    hydratedUserIdRef.current = u.id

    try {
      const [f, ul] = await Promise.all([getFoldersRemote(u.id), getUrlsRemote(u.id)])
      setFolders(f)
      setUrls(ul)
      writeCache(foldersCacheKey(u.id), f)
      writeCache(urlsCacheKey(u.id), ul)
    } catch (error) {
      console.error('Failed to load remote Unit Catcher data', error)
    } finally {
      await finish()
    }
  }, [])

  const setUser = useCallback((u: User | null) => {
    const prevUserId = hydratedUserIdRef.current
    if (!u && prevUserId) {
      localStorage.removeItem(foldersCacheKey(prevUserId))
      localStorage.removeItem(urlsCacheKey(prevUserId))
    }
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
    let u: User | null = null
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<User>
        if (parsed && parsed.id && parsed.account_name) {
          u = {
            id: parsed.id,
            account_name: parsed.account_name,
            created_at: parsed.created_at ?? '',
            has_password: parsed.has_password ?? false,
            bg_image_url: parsed.bg_image_url ?? null,
            bg_focal_x: parsed.bg_focal_x ?? 0.5,
            bg_focal_y: parsed.bg_focal_y ?? 0.5,
            bg_focal_x_pc: parsed.bg_focal_x_pc ?? 0.5,
            bg_focal_y_pc: parsed.bg_focal_y_pc ?? 0.5,
          }
        }
      } catch {
        u = null
      }
    }
    setUserState(u)
    loadData(u)
  }, [loadData])

  useEffect(() => {
    const uid = hydratedUserIdRef.current
    if (!uid || !user || user.id !== uid) return
    writeCache(foldersCacheKey(uid), folders)
  }, [folders, user])

  useEffect(() => {
    const uid = hydratedUserIdRef.current
    if (!uid || !user || user.id !== uid) return
    writeCache(urlsCacheKey(uid), urls)
  }, [urls, user])

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
      bgVersion, bumpBgVersion: () => setBgVersion(v => v + 1),
      isHydrating,
    }}>
      {children}
    </AppContext.Provider>
  )
}
