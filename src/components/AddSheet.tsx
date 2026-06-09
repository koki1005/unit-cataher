'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/lib/store'
import { Folder } from '@/lib/types'
import { saveUrl, getUrls, getFolders } from '@/lib/storage'
import { saveUrlRemote } from '@/lib/supabase-storage'

const QrCamera = dynamic(() => import('./QrCamera'), { ssr: false })
const QrUpload = dynamic(() => import('./QrUpload'), { ssr: false })

type Props = {
  open: boolean
  onClose: () => void
}

export default function AddSheet({ open, onClose }: Props) {
  const { user, folders, setUrls, setFolders, reload } = useApp()
  const [scannedUrl, setScannedUrl] = useState('')
  const [name, setName] = useState('')
  const [manualUrl, setManualUrl] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string>('root')
  const [step, setStep] = useState<'scan' | 'confirm'>('scan')
  const [activeTab, setActiveTab] = useState('manual')

  const resetState = () => {
    setScannedUrl('')
    setName('')
    setManualUrl('')
    setSelectedFolder('root')
    setStep('scan')
    setActiveTab('manual')
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleUrlDetected = (url: string) => {
    setScannedUrl(url)
    setStep('confirm')
  }

  const handleManualNext = () => {
    if (!manualUrl.trim()) return
    setScannedUrl(manualUrl.trim())
    setStep('confirm')
  }

  const handleSave = async () => {
    if (!name.trim() || !scannedUrl) return
    const folderId = selectedFolder === 'root' ? null : selectedFolder
    if (user) {
      await saveUrlRemote(user.id, name.trim(), scannedUrl, folderId)
      reload()
    } else {
      saveUrl(name.trim(), scannedUrl, folderId)
      setUrls(getUrls())
    }
    handleClose()
  }

  const buildFolderOptions = (folders: Folder[], parentId: string | null, depth = 0): { id: string; label: string }[] => {
    return folders
      .filter(f => f.parent_id === parentId)
      .flatMap(f => [
        { id: f.id, label: '　'.repeat(depth) + f.name },
        ...buildFolderOptions(folders, f.id, depth + 1),
      ])
  }

  const folderOptions = buildFolderOptions(folders, null)

  return (
    <Sheet open={open} onOpenChange={v => !v && handleClose()}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl overflow-y-auto" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>URLを追加</SheetTitle>
        </SheetHeader>

        {step === 'scan' ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="manual" className="flex-1">URLを貼る</TabsTrigger>
              <TabsTrigger value="camera" className="flex-1">カメラで読む</TabsTrigger>
              <TabsTrigger value="image" className="flex-1">画像から読む</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label>URL</Label>
                <Input
                  placeholder="https://..."
                  value={manualUrl}
                  onChange={e => setManualUrl(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleManualNext} disabled={!manualUrl.trim()}>
                次へ
              </Button>
            </TabsContent>

            <TabsContent value="camera" className="mt-4">
              {open && activeTab === 'camera' && <QrCamera onDetected={handleUrlDetected} />}
            </TabsContent>

            <TabsContent value="image" className="mt-4">
              {activeTab === 'image' && <QrUpload onDetected={handleUrlDetected} />}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="p-3 rounded-lg bg-muted text-sm break-all text-muted-foreground">
              {scannedUrl}
            </div>
            <div className="space-y-1">
              <Label>表示名 <span className="text-destructive">*</span></Label>
              <Input
                placeholder="例：ハッカソン2 出席"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>保存先フォルダ</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedFolder}
                onChange={e => setSelectedFolder(e.target.value)}
              >
                <option value="root">ルート（フォルダなし）</option>
                {folderOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('scan')}>戻る</Button>
              <Button className="flex-1" onClick={handleSave} disabled={!name.trim()}>登録する</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
