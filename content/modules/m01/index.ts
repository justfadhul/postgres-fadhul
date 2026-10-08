import type { ModuleContent } from '../../types'
import { CHECKS } from './checks'
import { ASSIGNMENT_IDS, CHALLENGES } from './challenges'

export const M01: ModuleContent = {
  id: 'm01-sql-fluency',
  lessons: [
    { id: 'm01-l01', number: '1.1', title: 'Joins without fear', minutes: 12, tier: 'B', file: '01-joins.mdx', summary: 'Combine patients, visits and facilities, and see why a join can multiply rows.' },
    { id: 'm01-l02', number: '1.2', title: 'Grouping and aggregates', minutes: 14, tier: 'B', file: '02-grouping.mdx', summary: 'Count, sum and filter groups, and know which count you are asking for.' },
    { id: 'm01-l03', number: '1.3', title: 'Subqueries and CTEs', minutes: 13, tier: 'B', file: '03-subqueries-ctes.mdx', summary: 'Ask questions about questions with subqueries, EXISTS and WITH.' },
    { id: 'm01-l04', number: '1.4', title: 'Recursive CTEs', minutes: 12, tier: 'B', file: '04-recursive-ctes.mdx', summary: 'Walk referral chains and build calendars with WITH RECURSIVE.' },
    { id: 'm01-l05', number: '1.5', title: 'Window functions', minutes: 15, tier: 'B', file: '05-window-functions.mdx', summary: 'Rank, number and compare rows without collapsing them.' },
    { id: 'm01-l06', number: '1.6', title: 'NULL and three-valued logic', minutes: 11, tier: 'B', file: '06-null.mdx', summary: 'Why NULL = NULL is not true, and the NOT IN trap that hides rows.' },
    { id: 'm01-l07', number: '1.7', title: 'Dates and time zones', minutes: 14, tier: 'B', file: '07-dates-time-zones.mdx', summary: 'timestamptz, Kampala time, half-open ranges and monthly reports.' },
  ],
  checks: CHECKS,
  challenges: CHALLENGES,
  assignment: {
    title: '30 reporting queries',
    intro: 'Thirty questions a clinic manager might ask, answered from the synthetic clinic dataset. Each is graded by comparing your rows with a reference answer.',
    challengeIds: ASSIGNMENT_IDS,
  },
}
