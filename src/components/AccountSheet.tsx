'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/lib/store'
import { registerUser, loginUser } from '@/lib/supabase-storage'
import { KeyRound, LogOut, UserCircle2 } from 'lucide-react'
import PasswordChangeDialog from './PasswordChangeDialog'

type Props = {
  open: boolean
  onClose: () => void
}

export default function AccountSheet({ open, onClose }: Props) {
  const { user, setUser } = useApp()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [accountName, setAccountName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [changePwOpen, setChangePwOpen] = useState(false)

  const resetForm = () => {
    setAccountName('')
    setPassword('')
    setPasswordConfirm('')
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    if (accountName.length < 8) {
      setError('アカウント名は8文字以上で入力してください')
      return
    }
    if (tab === 'register' && !password) {
      setError('パスワードを入力してください')
      return
    }
    if (tab === 'register' && password !== passwordConfirm) {
      setError('パスワードが一致しません')
      return
    }
    setLoading(true)
    try {
      if (tab === 'register') {
        const { user: newUser, error: err } = await registerUser(accountName.trim(), password)
        if (err) { setError(err); return }
        setUser(newUser!)
      } else {
        const { user: found, error: err } = await loginUser(accountName.trim(), password)
        if (err) { setError(err); return }
        setUser(found!)
      }
      resetForm()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setUser(null)
    onClose()
  }

  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>アカウント</SheetTitle>
          </SheetHeader>

          {user ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted">
                <UserCircle2 className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">ログイン中</p>
                  <p className="font-semibold">{user.account_name}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setChangePwOpen(true)}>
                <KeyRound className="w-4 h-4 mr-2" />
                パスワードを変更
              </Button>
              <Button variant="outline" className="w-full text-destructive border-destructive" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                ログアウト
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">アカウントなしでもご利用いただけます（ゲストモード）</p>

              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'login' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  onClick={() => { setTab('login'); setError(null) }}
                >ログイン</button>
                <button
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'register' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  onClick={() => { setTab('register'); setError(null) }}
                >新規登録</button>
              </div>

              <div className="space-y-1">
                <Label>アカウント名（8文字以上）</Label>
                <Input
                  placeholder="my_account_name"
                  value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>
                  パスワード
                  {tab === 'login' && (
                    <span className="text-xs text-muted-foreground ml-2">未設定アカウントは空欄でOK</span>
                  )}
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => tab === 'login' && e.key === 'Enter' && handleSubmit()}
                />
              </div>
              {tab === 'register' && (
                <div className="space-y-1">
                  <Label>パスワード（確認）</Label>
                  <Input
                    type="password"
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={loading || !accountName.trim() || (tab === 'register' && !password)}
              >
                {tab === 'login' ? 'ログイン' : '登録する'}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <PasswordChangeDialog open={changePwOpen} onClose={() => setChangePwOpen(false)} />
    </>
  )
}
