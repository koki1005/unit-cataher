import { getSupabase } from './supabase'
import { Folder, UrlItem, User } from './types'

// Users
function translateAuthError(message: string | undefined): string {
  if (!message) return '不明なエラーが発生しました'
  if (message.includes('account_name_too_short')) return 'アカウント名は8文字以上で入力してください'
  if (message.includes('account_name_taken')) return 'そのアカウント名は既に使われています'
  if (message.includes('account_not_found')) return 'アカウントが見つかりません'
  if (message.includes('password_required')) return 'パスワードを入力してください'
  if (message.includes('invalid_password')) return 'パスワードが間違っています'
  if (message.includes('password_already_set')) return 'パスワードは既に設定されています'
  if (message.includes('password_not_set')) return 'パスワードが未設定です'
  return message
}

export async function registerUser(
  account_name: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('register_user_with_password', {
    p_account_name: account_name,
    p_password: password,
  })
  if (error) return { user: null, error: translateAuthError(error.message) }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { user: null, error: '登録に失敗しました' }
  return { user: row as User, error: null }
}

export async function loginUser(
  account_name: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('login_with_password', {
    p_account_name: account_name,
    p_password: password,
  })
  if (error) return { user: null, error: translateAuthError(error.message) }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { user: null, error: 'アカウントが見つかりません' }
  return { user: row as User, error: null }
}

export async function setUserPassword(
  user_id: string,
  account_name: string,
  new_password: string
): Promise<{ error: string | null }> {
  const supabase = getSupabase()
  const { error } = await supabase.rpc('set_user_password', {
    p_user_id: user_id,
    p_account_name: account_name,
    p_new_password: new_password,
  })
  if (error) return { error: translateAuthError(error.message) }
  return { error: null }
}

export async function changeUserPassword(
  user_id: string,
  current_password: string,
  new_password: string
): Promise<{ error: string | null }> {
  const supabase = getSupabase()
  const { error } = await supabase.rpc('change_user_password', {
    p_user_id: user_id,
    p_current_password: current_password,
    p_new_password: new_password,
  })
  if (error) return { error: translateAuthError(error.message) }
  return { error: null }
}

// ---- Backgrounds ----

const BG_BUCKET = 'backgrounds'

function extFromMime(type: string): string {
  if (type === 'image/jpeg' || type === 'image/jpg') return 'jpg'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'bin'
}

export async function uploadBackgroundImage(
  user_id: string,
  scope: 'global' | 'folder' | 'url',
  scope_id: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const supabase = getSupabase()
  const ext = extFromMime(file.type)
  const path = `${user_id}/${scope}-${scope_id}-${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(BG_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) return { url: null, error: uploadError.message }
  const { data } = supabase.storage.from(BG_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function setUserBackgroundRemote(
  user_id: string,
  image_url: string | null,
  focal_x: number,
  focal_y: number,
  focal_x_pc: number,
  focal_y_pc: number
): Promise<{ error: string | null }> {
  const supabase = getSupabase()
  const { error } = await supabase.rpc('set_user_background', {
    p_user_id: user_id,
    p_image_url: image_url,
    p_focal_x: focal_x,
    p_focal_y: focal_y,
    p_focal_x_pc: focal_x_pc,
    p_focal_y_pc: focal_y_pc,
  })
  if (error) return { error: error.message }
  return { error: null }
}

export async function setFolderBackgroundRemote(
  id: string,
  image_url: string | null,
  focal_x: number,
  focal_y: number,
  focal_x_pc: number,
  focal_y_pc: number
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('folders')
    .update({ bg_image_url: image_url, bg_focal_x: focal_x, bg_focal_y: focal_y, bg_focal_x_pc: focal_x_pc, bg_focal_y_pc: focal_y_pc })
    .eq('id', id)
  if (error) throw error
}

export async function setUrlBackgroundRemote(
  id: string,
  image_url: string | null,
  focal_x: number,
  focal_y: number,
  focal_x_pc: number,
  focal_y_pc: number
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('urls')
    .update({ bg_image_url: image_url, bg_focal_x: focal_x, bg_focal_y: focal_y, bg_focal_x_pc: focal_x_pc, bg_focal_y_pc: focal_y_pc })
    .eq('id', id)
  if (error) throw error
}

// Folders
export async function getFoldersRemote(user_id: string): Promise<Folder[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', user_id)
    .order('position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function saveFolderRemote(
  user_id: string,
  name: string,
  parent_id: string | null
): Promise<Folder | null> {
  const supabase = getSupabase()
  let positionQuery = supabase
    .from('folders')
    .select('position')
    .eq('user_id', user_id)
  positionQuery = parent_id === null
    ? positionQuery.is('parent_id', null)
    : positionQuery.eq('parent_id', parent_id)
  const { data: siblings, error: positionError } = await positionQuery
  if (positionError) throw positionError
  const position = (siblings ?? []).reduce((max, item) => Math.max(max, item.position ?? -1), -1) + 1

  const { data, error } = await supabase
    .from('folders')
    .insert({ user_id, name, parent_id, position })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameFolderRemote(id: string, name: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('folders').update({ name }).eq('id', id)
  if (error) throw error
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
    const { error: urlError } = await supabase.from('urls').delete().eq('folder_id', fid)
    if (urlError) throw urlError
    const { error: folderError } = await supabase.from('folders').delete().eq('id', fid)
    if (folderError) throw folderError
  }
}

// URLs
export async function getUrlsRemote(user_id: string): Promise<UrlItem[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('urls')
    .select('*')
    .eq('user_id', user_id)
    .order('position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function saveUrlRemote(
  user_id: string,
  name: string,
  url: string,
  folder_id: string | null
): Promise<UrlItem | null> {
  const supabase = getSupabase()
  let positionQuery = supabase
    .from('urls')
    .select('position')
    .eq('user_id', user_id)
  positionQuery = folder_id === null
    ? positionQuery.is('folder_id', null)
    : positionQuery.eq('folder_id', folder_id)
  const { data: siblings, error: positionError } = await positionQuery
  if (positionError) throw positionError
  const position = (siblings ?? []).reduce((max, item) => Math.max(max, item.position ?? -1), -1) + 1

  const { data, error } = await supabase
    .from('urls')
    .insert({ user_id, name, url, folder_id, position })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteUrlRemote(id: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('urls').delete().eq('id', id)
  if (error) throw error
}

export async function renameUrlRemote(id: string, name: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('urls').update({ name }).eq('id', id)
  if (error) throw error
}

export async function moveUrlRemote(id: string, folder_id: string | null, position?: number): Promise<void> {
  const supabase = getSupabase()
  const update: Record<string, unknown> = { folder_id }
  if (position !== undefined) update.position = position
  const { error } = await supabase.from('urls').update(update).eq('id', id)
  if (error) throw error
}

export async function moveFolderRemote(id: string, parent_id: string | null, position?: number): Promise<void> {
  const supabase = getSupabase()
  const update: Record<string, unknown> = { parent_id }
  if (position !== undefined) update.position = position
  const { error } = await supabase.from('folders').update(update).eq('id', id)
  if (error) throw error
}

export async function deleteUrlsRemote(ids: string[]): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('urls').delete().in('id', ids)
  if (error) throw error
}

export async function reorderItemsRemote(
  folderUpdates: Array<{ id: string; position: number }>,
  urlUpdates: Array<{ id: string; position: number }>
): Promise<void> {
  const supabase = getSupabase()
  const results = await Promise.all([
    ...folderUpdates.map(({ id, position }) => supabase.from('folders').update({ position }).eq('id', id)),
    ...urlUpdates.map(({ id, position }) => supabase.from('urls').update({ position }).eq('id', id)),
  ])
  const failed = results.find(result => result.error)
  if (failed?.error) throw failed.error
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
    const { error: urlError } = await supabase.from('urls').delete().eq('folder_id', fid)
    if (urlError) throw urlError
    const { error: folderError } = await supabase.from('folders').delete().eq('id', fid)
    if (folderError) throw folderError
  }
}
