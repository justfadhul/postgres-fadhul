import type { ModuleContent } from '../types'
import { M00 } from './m00'
import { M01 } from './m01'

/** Module content by syllabus id. Modules without content yet are absent. */
export const MODULE_CONTENT: Record<string, ModuleContent> = {
  [M00.id]: M00,
  [M01.id]: M01,
}
