import type { ComponentType } from 'react'
import { MODULE_CONTENT } from '@content/modules'
import { MODULES, type ModuleOutline } from '@content/syllabus'
import type { Challenge, LessonMeta, ModuleContent, QuickCheck } from '@content/types'

// Lesson bodies are compiled MDX, loaded on demand (each lesson is its own small chunk).
const LESSON_FILES = import.meta.glob<{ default: ComponentType<{ components?: Record<string, unknown> }> }>(
  '../../../content/modules/*/lessons/*.mdx',
)

export interface LessonRef {
  lesson: LessonMeta
  module: ModuleOutline
  content: ModuleContent
  index: number
}

export function moduleContent(id: string): ModuleContent | undefined {
  return MODULE_CONTENT[id]
}

// Built once, so a lesson's ref is the same object on every call: components can depend on it.
const LESSONS: LessonRef[] = MODULES.flatMap((module) => {
  const content = MODULE_CONTENT[module.id]
  return content ? content.lessons.map((lesson, index) => ({ lesson, module, content, index })) : []
})

export function allLessons(): LessonRef[] {
  return LESSONS
}

export function findLesson(id: string): LessonRef | undefined {
  return allLessons().find((r) => r.lesson.id === id)
}

export function loadLessonBody(ref: LessonRef) {
  const key = `../../../content/modules/${ref.module.id.slice(0, 3)}/lessons/${ref.lesson.file}`
  const loader = LESSON_FILES[key]
  if (!loader) throw new Error(`Lesson file missing: ${key}`)
  return loader()
}

export function findCheck(id: string): QuickCheck | undefined {
  for (const c of Object.values(MODULE_CONTENT)) {
    const hit = c.checks.find((q) => q.id === id)
    if (hit) return hit
  }
  return undefined
}

export interface ChallengeRef {
  challenge: Challenge
  module: ModuleOutline
  content: ModuleContent
}

export function findChallenge(id: string): ChallengeRef | undefined {
  for (const module of MODULES) {
    const content = MODULE_CONTENT[module.id]
    const challenge = content?.challenges.find((c) => c.id === id)
    if (content && challenge) return { challenge, module, content }
  }
  return undefined
}
