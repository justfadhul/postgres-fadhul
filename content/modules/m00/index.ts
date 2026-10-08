import type { ModuleContent } from '../../types'
import { CHECKS } from './checks'
import { ASSIGNMENT_IDS, CHALLENGES } from './challenges'

export const M00: ModuleContent = {
  id: 'm00-foundations',
  lessons: [
    { id: 'm00-l01', number: '0.1', title: 'The big picture', minutes: 10, tier: 'B', file: '01-big-picture.mdx', summary: 'What databases, SQL and PostgreSQL are, how this site runs PostgreSQL in your browser, and a map of the course.' },
    { id: 'm00-l02', number: '0.2', title: 'Tables, rows and keys', minutes: 10, tier: 'B', file: '02-tables-keys.mdx', summary: 'Tour the clinic tables, and see how primary and foreign keys link them.' },
    { id: 'm00-l03', number: '0.3', title: 'Asking questions with SELECT', minutes: 11, tier: 'B', file: '03-select.mdx', summary: 'Choose columns, sort, limit, compute, rename and remove duplicates.' },
    { id: 'm00-l04', number: '0.4', title: 'Filtering rows with WHERE', minutes: 11, tier: 'B', file: '04-where.mdx', summary: 'Comparisons, AND, OR and NOT, IN, BETWEEN, LIKE and a first look at IS NULL.' },
    { id: 'm00-l05', number: '0.5', title: 'Types and values', minutes: 10, tier: 'B', file: '05-types-values.mdx', summary: 'Data types, quotes, casts, the integer division surprise, and NULL in one paragraph.' },
    { id: 'm00-l06', number: '0.6', title: 'Counting and summarising', minutes: 10, tier: 'B', file: '06-summaries.mdx', summary: 'count, sum, avg, min and max, percentages that keep their decimals, and a first GROUP BY.' },
    { id: 'm00-l07', number: '0.7', title: 'Changing data safely', minutes: 12, tier: 'B', file: '07-changing-data.mdx', summary: 'CREATE TABLE, INSERT, UPDATE and DELETE, constraints that say no, and transactions as an undo button.' },
  ],
  checks: CHECKS,
  challenges: CHALLENGES,
  assignment: {
    title: 'Basics practice',
    intro: 'Twelve short questions about the synthetic clinic data, each answerable from one table with the ideas in this module. Each is graded by comparing your rows with a reference answer.',
    challengeIds: ASSIGNMENT_IDS,
  },
}
