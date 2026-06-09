'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/lib/store'
import { setUserPassword } from '@/lib/supabase-storage'
import { Lock, LogOut, ShieldAlert } from 'lucide-react'

export default function PasswordSetupRequired() {
  const { user, setUser } = useApp()
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!user) return null

  const handleSubmit = async () => {
    setError(null)
    if (!pw1) {
      setError('パスワードを入力してください')
      return
    }
    if (pw1 !== pw2) {
      setError('パスワードが一致しません')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await setUserPassword(user.id, user.account_name, pw1)
      if (err) {
        setError(err)
        return
      }
      setUser({ ...user, has_password: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 max-w-lg mx-auto">
      <div className="w-full space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="font-bold text-xl">パスワードを設定してください</h1>
            <p className="text-sm text-muted-foreground mt-2">
              セキュリティ強化のため、ご利用中のアカウント「{user.account_name}」にパスワード設定が必要になりました
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>新しいパスワード</Label>
            <Input
              type="password"
              value={pw1}
              onChange={e => setPw1(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>パスワード（確認）</Label>
            <Input
              type="password"
              value={pw2}
              onChange={e => setPw2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={handleSubmit} disabled={loading || !pw1 || !pw2}>
            <Lock className="w-4 h-4 mr-2" />
            パスワードを設定する
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => setUser(null)}
          >
            <LogOut className="w-4 h-4 mr-2" />
            ログアウトしてあとで設定する
          </Button>
        </div>
      </div>
    </div>
  )
}
