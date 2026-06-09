'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

type Props = {
  src: string
  phoneX: number
  phoneY: number
  pcX: number
  pcY: number
  scope?: 'screen' | 'card'
  onChange: (which: 'phone' | 'pc', x: number, y: number) => void
}

const SCREEN_PHONE_AR = 9 / 16
const SCREEN_PC_AR = 16 / 9
// カード表示の概算: スマホ ≒ 390/64 ≒ 6:1, PC ≒ 512/64 = 8:1
const CARD_PHONE_AR = 6
const CARD_PC_AR = 8

export default function FocalPointPicker({ src, phoneX, phoneY, pcX, pcY, scope = 'screen', onChange }: Props) {
  const PHONE_AR = scope === 'card' ? CARD_PHONE_AR : SCREEN_PHONE_AR
  const PC_AR = scope === 'card' ? CARD_PC_AR : SCREEN_PC_AR
  const ref = useRef<HTMLDivElement>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const dragInfo = useRef<{ which: 'phone' | 'pc'; dx: number; dy: number } | null>(null)
  const focalRef = useRef({ phoneX, phoneY, pcX, pcY })
  focalRef.current = { phoneX, phoneY, pcX, pcY }

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = src
  }, [src])

  const ai = imgSize ? imgSize.w / imgSize.h : 16 / 9

  const calcFrameSize = (ar: number) => {
    if (ai > ar) return { w: ar / ai, h: 1 }
    return { w: 1, h: ai / ar }
  }

  const phone = calcFrameSize(PHONE_AR)
  const pc = calcFrameSize(PC_AR)

  const moveTo = useCallback((clientX: number, clientY: number) => {
    const el = ref.current
    const info = dragInfo.current
    if (!el || !info) return
    const rect = el.getBoundingClientRect()
    const rawX = (clientX - rect.left) / rect.width - info.dx
    const rawY = (clientY - rect.top) / rect.height - info.dy
    const size = info.which === 'phone' ? phone : pc
    const cx = Math.max(size.w / 2, Math.min(1 - size.w / 2, rawX))
    const cy = Math.max(size.h / 2, Math.min(1 - size.h / 2, rawY))
    onChange(info.which, cx, cy)
  }, [phone, pc, onChange])

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!dragInfo.current) return
      e.preventDefault()
      moveTo(e.clientX, e.clientY)
    }
    const handleUp = () => {
      dragInfo.current = null
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [moveTo])

  const startDrag = (which: 'phone' | 'pc') => (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    e.preventDefault()
    e.stopPropagation()
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const fx = which === 'phone' ? focalRef.current.phoneX : focalRef.current.pcX
    const fy = which === 'phone' ? focalRef.current.phoneY : focalRef.current.pcY
    dragInfo.current = { which, dx: px - fx, dy: py - fy }
  }

  const containerAspect = imgSize ? `${imgSize.w} / ${imgSize.h}` : '16 / 9'

  const frameStyle = (size: { w: number; h: number }, x: number, y: number): React.CSSProperties => ({
    width: `${size.w * 100}%`,
    height: `${size.h * 100}%`,
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    transform: 'translate(-50%, -50%)',
  })

  // 小さい方を上に重ねて、重なった部分で小さい方を掴めるように
  const phoneArea = phone.w * phone.h
  const pcArea = pc.w * pc.h
  const phoneOnTop = phoneArea <= pcArea

  const phoneFrame = (
    <div
      key="phone"
      className="absolute border-2 border-pink-400 shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move touch-none"
      style={frameStyle(phone, phoneX, phoneY)}
      onPointerDown={startDrag('phone')}
    >
      <span className="absolute -bottom-5 right-0 text-[10px] font-medium text-pink-400 bg-black/60 px-1 rounded pointer-events-none">スマホ</span>
    </div>
  )

  const pcFrame = (
    <div
      key="pc"
      className="absolute border-2 border-cyan-400 shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move touch-none"
      style={frameStyle(pc, pcX, pcY)}
      onPointerDown={startDrag('pc')}
    >
      <span className="absolute -top-5 left-0 text-[10px] font-medium text-cyan-400 bg-black/60 px-1 rounded pointer-events-none">PC</span>
    </div>
  )

  return (
    <div className="space-y-2">
      <div
        ref={ref}
        className="relative w-full rounded-lg overflow-hidden border border-border select-none bg-muted"
        style={{ aspectRatio: containerAspect, maxHeight: '60vh' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="preview"
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-70"
        />
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
            <mask id="frame-mask">
              <rect x="0" y="0" width="100" height="100" fill="white" />
              <rect
                x={(pcX - pc.w / 2) * 100}
                y={(pcY - pc.h / 2) * 100}
                width={pc.w * 100}
                height={pc.h * 100}
                fill="black"
              />
              <rect
                x={(phoneX - phone.w / 2) * 100}
                y={(phoneY - phone.h / 2) * 100}
                width={phone.w * 100}
                height={phone.h * 100}
                fill="black"
              />
            </mask>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill="black" fillOpacity="0.4" mask="url(#frame-mask)" />
        </svg>

        {phoneOnTop ? <>{pcFrame}{phoneFrame}</> : <>{phoneFrame}{pcFrame}</>}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        スマホ枠 (ピンク) とPC枠 (シアン) をそれぞれドラッグして調整してね
      </p>
    </div>
  )
}
