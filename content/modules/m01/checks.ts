import type { QuickCheck } from '../../types'
import { CHECKS_L01_L04 } from './checks-l01-l04'
import { CHECKS_L05_L07 } from './checks-l05-l07'

// Quick checks for Module 1, in lesson order. Each is placed in its lesson with <QuickCheck id="…" />.
export const CHECKS: QuickCheck[] = [...CHECKS_L01_L04, ...CHECKS_L05_L07]
