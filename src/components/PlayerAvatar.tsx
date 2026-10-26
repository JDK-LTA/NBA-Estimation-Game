import { useState } from 'react'
import { assetUrl } from '../data/loaders.ts'
import { initialsOf } from '../logic/display.ts'
import { hashString } from '../logic/rng.ts'
import type { Player } from '../types/index.ts'
import styles from './PlayerAvatar.module.css'

interface PlayerAvatarProps {
  player: Player | undefined
  size?: number
  ringColor?: string
}

export function PlayerAvatar({ player, size = 40, ringColor }: PlayerAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const name = player?.fullName ?? 'Unknown player'
  const showPhoto = Boolean(player?.photoUrl) && failedUrl !== player?.photoUrl
  const hue = hashString(name) % 360

  return (
    <span
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hue} 35% 38%)`,
        ...(ringColor ? { boxShadow: `0 0 0 3px ${ringColor}` } : null),
      }}
      aria-hidden="true"
    >
      {showPhoto && player?.photoUrl ? (
        <img
          src={assetUrl(player.photoUrl)}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailedUrl(player.photoUrl)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  )
}
