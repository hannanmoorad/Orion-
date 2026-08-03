import React from 'react'

export default function OrionAvatar({ state = 'idle', size = 'lg', label }) {
  const cls = 'orb ' + state + ' orb-' + size
  return (
    <div className={cls} aria-label={label || 'Orion avatar'}>
      <div className="orb-halo" />
      <div className="orb-body">
        <div className="orb-shine" />
        <div className="orb-face">
          <div className="orb-eyes">
            <span className="orb-eye orb-eye-l" />
            <span className="orb-eye orb-eye-r" />
          </div>
          <div className="orb-mouth">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i} className={'m-bar m' + i} />
            ))}
          </div>
        </div>
      </div>
      <div className="orb-ring" />
      <div className="orb-ring orb-ring-2" />
      <div className="orb-sparkles">
        <span className="spark s1" />
        <span className="spark s2" />
        <span className="spark s3" />
        <span className="spark s4" />
      </div>
      {state === 'listening' && (
        <div className="wave-bars">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={'wbar wb' + i} />
          ))}
        </div>
      )}
    </div>
  )
}