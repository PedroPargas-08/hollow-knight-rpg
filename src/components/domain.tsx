/** Máscara original (não é a de nenhum jogo): ovalada, olhos em fenda e coroa recortada. */
export function MaskGlyph({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'mask'} viewBox="0 0 30 34" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M15 1.8c-6 0-11 3-11 9 0 9 4.500 19 11 21 6.500-2 11-12 11-21 0-6-5-9-11-9z" />
      <path d="M7.500 12.500l5.500 4M22.500 12.500L17 16.500M15 19v7M10 5.500l2 4M20 5.500l-2 4" />
    </svg>
  );
}

/** Estalactites e ruínas desenhadas por código: poucas formas, sem imagens externas. */
export function Backdrop({ ruins = true }: { ruins?: boolean }) {
  const spikes: [number, number, number][] = [[10, 46, 120], [90, 30, 70], [150, 54, 170], [260, 34, 90], [330, 50, 140], [440, 28, 60], [510, 60, 180], [640, 36, 80], [720, 52, 150], [830, 30, 100], [900, 56, 170], [1010, 34, 80], [1080, 48, 130]];
  const top = 'M0 0 ' + spikes.map(([x, w, h]) => `L${x} 0 L${x + w / 2} ${h} L${x + w} 0`).join(' ') + ' L1200 0 Z';
  const arches = [60, 250, 470, 700, 930];
  return (
    <div className="backdrop" aria-hidden="true">
      <svg className="top" viewBox="0 0 1200 190" preserveAspectRatio="none"><defs><linearGradient id="bk-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1326" /><stop offset="1" stopColor="#0d1326" stopOpacity="0" /></linearGradient></defs><path d={top} fill="url(#bk-top)" /></svg>
      {ruins && (
        <svg className="bottom" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice">
          <defs><linearGradient id="bk-bot" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#0b0f1d" /><stop offset="1" stopColor="#0b0f1d" stopOpacity="0" /></linearGradient></defs>
          {arches.map((x) => <path key={x} d={`M${x} 220 V120 a50 50 0 0 1 100 0 V220 M${x + 18} 220 V125 a32 32 0 0 1 64 0 V220`} fill="none" stroke="url(#bk-bot)" strokeWidth="14" />)}
          <rect x="0" y="206" width="1200" height="14" fill="#0b0f1d" opacity=".9" />
        </svg>
      )}
    </div>
  );
}

/** Capas provisórias e originais, feitas só com formas e gradientes. */
export function CampaignArt({ art }: { art: 'cinzas' | 'coro' | 'sinos' }) {
  return (
    <svg className="camp-art" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`g-${art}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={art === 'coro' ? '#0e2a4a' : art === 'sinos' ? '#241a44' : '#171d33'} /><stop offset="1" stopColor="#07090f" />
        </linearGradient>
      </defs>
      <rect width="320" height="120" fill={`url(#g-${art})`} />
      {art === 'cinzas' && <><path d="M0 100 L60 60 L110 90 L170 40 L240 85 L320 55 V120 H0Z" fill="#0a0d17" /><circle cx="250" cy="30" r="12" fill="none" stroke="#7db3ff" strokeOpacity=".5" /></>}
      {art === 'coro' && [18, 34, 52, 72].map((r) => <ellipse key={r} cx="160" cy="80" rx={r * 2.4} ry={r * .7} fill="none" stroke="#7db3ff" strokeOpacity={0.6 - r / 160} />)}
      {art === 'sinos' && <><path d="M160 24c-22 0-30 22-30 44l-10 14h80l-10-14c0-22-8-44-30-44z" fill="none" stroke="#a58ae0" strokeOpacity=".7" strokeWidth="2" /><path d="M150 90q10 10 20 0" fill="none" stroke="#a58ae0" strokeOpacity=".7" strokeWidth="2" /></>}
    </svg>
  );
}
