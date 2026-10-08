import type { ModuleContent } from '../types'
import { M01 } from './m01'

/** Module content by syllabus id. Modules without content yet are absent. */
export const MODULE_CONTENT: Record<string, ModuleContent> = {
  [M01.id]: M01,
}
