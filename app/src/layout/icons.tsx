// Inline stroke icons (no icon font, no downloads).
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true } as const

export const IconHome = () => (<svg {...base}><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></svg>)
export const IconList = () => (<svg {...base}><path d="M4 6h16M4 12h16M4 18h10" /></svg>)
export const IconCode = () => (<svg {...base}><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" /></svg>)
export const IconMore = () => (<svg {...base}><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></svg>)
export const IconMoon = () => (<svg {...base} width={20} height={20}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>)
export const IconBack = () => (<svg {...base} width={20} height={20} strokeWidth={2}><path d="m15 18-6-6 6-6" /></svg>)
export const IconPlay = () => (<svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15l13-7.5z" /></svg>)
export const IconPlan = () => (<svg {...base}><path d="M4 6h10M8 12h12M4 18h8" /></svg>)
export const IconReset = () => (<svg {...base}><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" /></svg>)
export const IconTick = () => (<svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="m2.5 6.2 2.3 2.3 4.7-5" /></svg>)
export const IconHighlight = () => (<svg {...base}><path d="m14.5 4.5 5 5L10 19H5v-5z" /><path d="M4 21h16" /></svg>)
export const IconPanel = () => (<svg {...base} width={20} height={20}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></svg>)
