// Free resources the lessons link to. scripts/check-links.mjs checks every URL
// here in CI; replace a dead link rather than removing the check.

export interface Resource {
  title: string
  url: string
  useFor: string
}

export const RESOURCES: Resource[] = [
  { title: 'PostgreSQL documentation', url: 'https://www.postgresql.org/docs/current/', useFor: 'Modules 1 to 6; the authority on behaviour' },
  { title: 'PostgreSQL Exercises', url: 'https://pgexercises.com/', useFor: 'Module 1 practice' },
  { title: 'Use The Index, Luke', url: 'https://use-the-index-luke.com/', useFor: 'Module 3' },
  { title: 'CMU 15-445 Intro to Database Systems', url: 'https://15445.courses.cs.cmu.edu/', useFor: 'Storage, indexes, transactions, recovery' },
  { title: 'Hermitage isolation tests', url: 'https://github.com/ept/hermitage', useFor: 'Module 4' },
  { title: 'The Internals of PostgreSQL', url: 'https://www.interdb.jp/pg/', useFor: 'Module 5' },
  { title: 'PostgreSQL 14 Internals (Rogov), free PDF', url: 'https://postgrespro.com/community/books/internals', useFor: 'Module 5' },
  { title: 'Supabase row-level security guide', url: 'https://supabase.com/docs/guides/database/postgres/row-level-security', useFor: 'Module 6' },
  { title: 'OWASP Top Ten', url: 'https://owasp.org/www-project-top-ten/', useFor: 'Module 6' },
  { title: 'A Tour of Go', url: 'https://go.dev/tour/', useFor: 'Module 8, stage 1' },
  { title: 'Build Your Own Database, Part I (chapters 0 to 7 free online)', url: 'https://build-your-own.org/database/', useFor: 'Module 8, B-tree and crash recovery' },
  { title: 'Operating Systems: Three Easy Pieces (chapter 42, FSCK and Journaling)', url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/', useFor: 'Module 8, crash consistency' },
  { title: 'Bitcask: A Log-Structured Hash Table for Fast Key/Value Data', url: 'https://riak.com/assets/bitcask-intro.pdf', useFor: 'Module 8, stage 2' },
  { title: 'Kleppmann, Distributed Systems lecture notes', url: 'https://www.cl.cam.ac.uk/teaching/2122/ConcDisSys/dist-sys-notes.pdf', useFor: 'Modules 9 and 10' },
  { title: 'Kleppmann, Distributed Systems lecture videos', url: 'https://www.youtube.com/playlist?list=PLeKd45zvjcDFUEv_ohr_HdUFe97RItdiB', useFor: 'Modules 9 and 10' },
  { title: 'MIT 6.5840 Distributed Systems', url: 'https://pdos.csail.mit.edu/6.824/', useFor: 'Module 9' },
  { title: 'Raft', url: 'https://raft.github.io/', useFor: 'Module 9' },
  { title: 'Jepsen consistency models', url: 'https://jepsen.io/consistency', useFor: 'Module 9' },
  { title: 'Local-first software', url: 'https://www.inkandswitch.com/essay/local-first/', useFor: 'Module 10' },
  { title: 'crdt.tech', url: 'https://crdt.tech/', useFor: 'Module 10' },
]
