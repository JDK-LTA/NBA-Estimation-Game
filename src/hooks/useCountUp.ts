import { useEffect, useState } from 'react'

function motionAllowed(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    typeof window.requestAnimationFrame === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** True while an animation should actually play (false for reduced-motion and non-browser environments). */
export function useMotionAllowed(): boolean {
  const [allowed] = useState(motionAllowed)
  return allowed
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

interface CountUpOptions {
  animate: boolean
  durationMs?: number
  delayMs?: number
}

/** Counts from 0 up to `target` once; shows `target` immediately when not animating. */
export function useCountUp(target: number, { animate, durationMs = 900, delayMs = 0 }: CountUpOptions): number {
  const play = useMotionAllowed() && animate
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!play) return
    const startedAt = performance.now() + delayMs
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / durationMs))
      setValue(Math.round(target * easeOutCubic(progress)))
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [target, play, durationMs, delayMs])

  return play ? value : target
}
