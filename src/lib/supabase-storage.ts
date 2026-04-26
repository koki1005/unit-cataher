import { getSupabase } from './supabase'
import { Folder, UrlItem, User } from './types'

// Users
export async function registerUser(account_name: string): Promise<{ user: User | null; error: string | null }> {
  const supabase = getSupabase()
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('account_name', account_name)
    .single()
  if (existing) return { user: null, error: 'そのアカウント名は既に使われています' }

  const { data, error } = await supabase
    .from('users')
    .insert({ account_name })
    .select()
    .single()
  if (error) return { user: null, error: error.message }
  return { user: data, error: null }
}

export async function loginUser(account_name: string): Promise<{ user: User | null; error: string | null }> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('account_name', account_name)
    .single()
  if (error || !data) return { user: null, error: 'アカウントが見つかりません' }
  return { user: data, error: null }
}

// Folders
export async function getFoldersRemote(user_id: string): Promise<Folder[]> {
  const supabase = getSupabase()
  const { data } = await supabase.from('folders').select('*').eq('user_id', user_id).order('position', { ascending: true, nullsFirst: false })
  return data ?? []
}

export async function saveFolderRemote(
  user_id: string,
  name: string,
  parent_id: string | null
): Promise<Folder | null> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('folders')
    .insert({ user_id, name, parent_id })
    .select()
    .single()
  return data
}

export async function renameFolderRemote(id: string, name: string): Promise<void> {
  const supabase = getSupabase()
  await supabase.from('folders').update({ name }).eq('id', id)
}

export async function deleteFolderRemote(id: string, allFolders: Folder[]): Promise<void> {
  const supabase = getSupabase()
  const toDelete = new Set<string>()
  const queue = [id]
  while (queue.length > 0) {
    const current = queue.shift()!
    toDelete.add(current)
    allFolders.filter(f => f.parent_id === current).forEach(f => queue.push(f.id))
  }
  for (const fid of Array.from(toDelete)) {
    await supabase.from('urls').delete().eq('folder_id', fid)
    await supabase.from('folders').delete().eq('id', fid)
  }
}

// URLs
export async function getUrlsRemote(user_id: string): Promise<UrlItem[]> {
  const supabase = getSupabase()
  const { data } = await supabase.from('urls').select('*').eq('user_id', user_id).order('position', { ascending: true, nullsFirst: false })
  return data ?? []
}

export async function saveUrlRemote(
  user_id: string,
  name: string,
  url: string,
  folder_id: string | null
): Promise<UrlItem | null> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('urls')
    .insert({ user_id, name, url, folder_id })
    .select()
    .single()
  return data
}

export async function deleteUrlRemote(id: string): Promise<void> {
  const supabase = getSupabase()
  await supabase.from('urls').delete().eq('id', id)
}

export async function renameUrlRemote(id: string, name: string): Promise<void> {
  const supabase = getSupabase()
  await supabase.from('urls').update({ name }).eq('id', id)
}

export async function moveUrlRemote(id: string, folder_id: string | null, position?: number): Promise<void> {
  const supabase = getSupabase()
  const update: Record<string, unknown> = { folder_id }
  if (position !== undefined) update.position = position
  await supabase.from('urls').update(update).eq('id', id)
}

export async function moveFolderRemote(id: string, parent_id: string | null, position?: number): Promise<void> {
  const supabase = getSupabase()
  const update: Record<string, unknown> = { parent_id }
  if (position !== undefined) update.position = position
  await supabase.from('folders').update(update).eq('id', id)
}

export async function deleteUrlsRemote(ids: string[]): Promise<void> {
  const supabase = getSupabase()
  await supabase.from('urls').delete().in('id', ids)
}

export async function reorderItemsRemote(
  folderUpdates: Array<{ id: string; position: number }>,
  urlUpdates: Array<{ id: string; position: number }>
): Promise<void> {
  const supabase = getSupabase()
  await Promise.all([
    ...folderUpdates.map(({ id, position }) => supabase.from('folders').update({ position }).eq('id', id)),
    ...urlUpdates.map(({ id, position }) => supabase.from('urls').update({ position }).eq('id', id)),
  ])
}

export async function deleteFoldersRemote(ids: string[], allFolders: Folder[]): Promise<void> {
  const supabase = getSupabase()
  const toDelete = new Set<string>()
  for (const id of ids) {
    const queue = [id]
    while (queue.length > 0) {
      const current = queue.shift()!
      toDelete.add(current)
      allFolders.filter(f => f.parent_id === current).forEach(f => queue.push(f.id))
    }
  }
  for (const fid of Array.from(toDelete)) {
    await supabase.from('urls').delete().eq('folder_id', fid)
    await supabase.from('folders').delete().eq('id', fid)
  }
}
