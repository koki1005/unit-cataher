export type Folder = {
  id: string
  user_id: string | null
  name: string
  parent_id: string | null
  position: number | null
  created_at: string
  bg_image_url: string | null
  bg_focal_x: number
  bg_focal_y: number
  bg_focal_x_pc: number
  bg_focal_y_pc: number
}

export type UrlItem = {
  id: string
  user_id: string | null
  folder_id: string | null
  name: string
  url: string
  position: number | null
  created_at: string
  bg_image_url: string | null
  bg_focal_x: number
  bg_focal_y: number
  bg_focal_x_pc: number
  bg_focal_y_pc: number
}

export type User = {
  id: string
  account_name: string
  created_at: string
  has_password: boolean
  bg_image_url: string | null
  bg_focal_x: number
  bg_focal_y: number
  bg_focal_x_pc: number
  bg_focal_y_pc: number
}

export type SortableItem =
  | { type: 'folder'; item: Folder; sortId: string; pos: number }
  | { type: 'url'; item: UrlItem; sortId: string; pos: number }
