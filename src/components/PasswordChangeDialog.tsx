'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/lib/store'
import { changeUserPassword } from '@/lib/supabase-storage'

type Props = {
  open: boolean
  onClose: () => void
}

export default function PasswordChangeDialog({ open, onClose }: Props) {
  const { user } = useApp()
  const [current, setCurrent] = useState('')
  const [next1, setNext1] = useState('')
  const [next2, setNext2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setCurrent('')
    setNext1('')
    setNext2('')
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!user) return
    setError(null)
    if (!current) {
      setError('現在のパスワードを入力してください')
      return
    }
    if (!next1) {
      setError('新しいパスワードを入力してください')
      return
    }
    if (next1 !== next2) {
      setError('新しいパスワードが一致しません')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await changeUserPassword(user.id, current, next1)
      if (err) {
        setError(err)
        return
      }
      handleClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="w-[90vw] max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>パスワードを変更</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>現在のパスワード</Label>
            <Input type="password" value={current} onChange={e => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>新しいパスワード</Label>
            <Input type="password" value={next1} onChange={e => setNext1(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>新しいパスワード（確認）</Label>
            <Input
              type="password"
              value={next2}
              onChange={e => setNext2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={loading || !current || !next1 || !next2}>
            変更する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
