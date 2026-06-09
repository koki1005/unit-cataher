'use client'

import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Image as ImageIcon, X } from 'lucide-react'
import FocalPointPicker from './FocalPointPicker'
import { useApp } from '@/lib/store'
import { uploadBackgroundImage, setUserBackgroundRemote } from '@/lib/supabase-storage'
import { getGuestBackground, setGuestBackground } from '@/lib/storage'

type Props = {
  open: boolean
  onClose: () => void
}

const MAX_FILE_BYTES = 5 * 1024 * 1024
const GUEST_DATAURL_MAX = 500 * 1024

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export default function GlobalBackgroundDialog({ open, onClose }: Props) {
  const { user, setUser, bumpBgVersion } = useApp()
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const [fx, setFx] = useState(0.5)
  const [fy, setFy] = useState(0.5)
  const [fxPc, setFxPc] = useState(0.5)
  const [fyPc, setFyPc] = useState(0.5)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (user) {
      setBgUrl(user.bg_image_url)
      setFx(user.bg_focal_x)
      setFy(user.bg_focal_y)
      setFxPc(user.bg_focal_x_pc)
      setFyPc(user.bg_focal_y_pc)
    } else {
      const g = getGuestBackground()
      setBgUrl(g.url)
      setFx(g.focal_x)
      setFy(g.focal_y)
      setFxPc(g.focal_x_pc)
      setFyPc(g.focal_y_pc)
    }
    setError(null)
  }, [open, user])

  const handleFile = async (file: File) => {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選んでね')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('画像は5MBまでにしてね')
      return
    }
    setUploading(true)
    try {
      if (user) {
        const { url, error: upErr } = await uploadBackgroundImage(user.id, 'global', user.id, file)
        if (upErr || !url) {
          console.error('bg upload error', upErr)
          setError(`アップロード失敗: ${upErr ?? '不明なエラー'}`)
          return
        }
        setBgUrl(url)
      } else {
        if (file.size > GUEST_DATAURL_MAX) {
          setError('未ログインの場合は500KBまでの画像にしてね')
          return
        }
        const dataUrl = await fileToDataUrl(file)
        setBgUrl(dataUrl)
      }
      setFx(0.5)
      setFy(0.5)
      setFxPc(0.5)
      setFyPc(0.5)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (user) {
      const { error: e } = await setUserBackgroundRemote(user.id, bgUrl, fx, fy, fxPc, fyPc)
      if (e) {
        setError('保存に失敗しました')
        return
      }
      setUser({ ...user, bg_image_url: bgUrl, bg_focal_x: fx, bg_focal_y: fy, bg_focal_x_pc: fxPc, bg_focal_y_pc: fyPc })
    } else {
      setGuestBackground({ url: bgUrl, focal_x: fx, focal_y: fy, focal_x_pc: fxPc, focal_y_pc: fyPc })
      bumpBgVersion()
    }
    onClose()
  }

  const handleRemove = () => {
    setBgUrl(null)
    setFx(0.5)
    setFy(0.5)
    setFxPc(0.5)
    setFyPc(0.5)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[92vw] max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>全体の背景を設定</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {bgUrl ? (
            <>
              <FocalPointPicker
                src={bgUrl}
                phoneX={fx}
                phoneY={fy}
                pcX={fxPc}
                pcY={fyPc}
                onChange={(which, x, y) => {
                  if (which === 'phone') { setFx(x); setFy(y) }
                  else { setFxPc(x); setFyPc(y) }
                }}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  画像を変更
                </Button>
                <Button variant="outline" size="sm" onClick={handleRemove}>
                  <X className="w-4 h-4 mr-1" />削除
                </Button>
              </div>
            </>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full aspect-[9/16] max-h-[50vh] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/50 transition"
            >
              <ImageIcon className="w-10 h-10" />
              <span className="text-sm">{uploading ? 'アップロード中…' : '画像を選択'}</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave} disabled={uploading}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
