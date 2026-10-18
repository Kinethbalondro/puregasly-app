import { useState } from 'react';
import { mediaUrl } from '../api/axios';

// Round profile picture. Falls back to the person's initials when there is no
// photo (or the photo fails to load).
export default function Avatar({ name = '', src, size = 36, className = '' }) {
  const [failed, setFailed] = useState(false);
  const initials = String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?';

  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };

  return (
    <span className={`avatar ${className}`} style={style} aria-hidden="true">
      {src && !failed ? (
        <img src={mediaUrl(src)} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        initials
      )}
    </span>
  );
}
