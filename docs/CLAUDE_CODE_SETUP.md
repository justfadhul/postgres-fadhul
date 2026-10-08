# Claude Code setup

This explains, in plain language, how Claude Code is set up in this repository and why. It was
written against Claude Code **2.1.293** (`claude --version` in the build session) and the docs at
[code.claude.com](https://code.claude.com/docs/en/overview) as they were on 8 October 2026.
Settings syntax changes between versions, so check the docs if something here stops working.

## Two kinds of session

- **Building the platform** (this repo's `app/`, `content/`, tests): Claude writes the code and
  the lessons.
- **Studying** (in `labs/`): Claude is your tutor. It explains, reviews and hints, but does not
  write the lab solutions for you (`labs/CLAUDE.md`).

## Permission modes

A permission mode decides how much Claude may do without asking you first.

| When | Mode | What it means |
| --- | --- | --- |
| Planning a milestone | **Plan** | Claude reads and proposes; it changes nothing until you approve. |
| Building | **Auto** if your session offers it, otherwise **Accept edits** | Auto lets a safety check approve routine actions. Accept edits lets Claude edit files freely but asks before other commands not on the allow list. |
| Never | Bypass permissions | It switches off every check. Cloud sessions do not offer it. |

The project file `.claude/settings.json` sets `"defaultMode": "acceptEdits"`. It cannot set
`auto`, because Claude Code ignores `auto` (and `bypassPermissions`) when they come from a project
file. You pick Auto yourself when you want it.

### Switching modes

- **iPhone (Claude app):** in the prompt box tap **+**, then **Permission**, and choose Plan,
  Accept edits or Auto.
- **Browser (claude.ai/code):** use the mode menu next to the prompt box.
- **Terminal:** press **Shift+Tab** to cycle through the modes, or start with
  `claude --permission-mode plan`.

Cloud sessions (the ones you start from the app or claude.ai/code) offer Accept edits, Plan and
Auto. Auto appears only if your plan and the chosen model support it.

Docs: [Permission modes](https://code.claude.com/docs/en/permission-modes),
[Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web).

## `.claude/settings.json`

- **allow**: commands Claude may run without asking. These are narrow on purpose: the npm
  scripts, Vitest, Playwright, the TypeScript and ESLint checks, Go tests, `make check`, and
  read-only or local git commands.
- **ask**: `git push` and `gh` always ask first, because they change things outside your
  computer.
- **deny**: Claude may never read `.env` files and may never force-push.
- In **Auto** mode, Claude Code temporarily drops broad allow rules that could run arbitrary code,
  such as package-manager run commands like `npm run *`. That is expected: Auto's own safety
  check covers those commands instead, and the rules come back when you leave Auto.
- **No `outputStyle`** is committed. Building sessions use the default style.

Docs: [Permissions](https://code.claude.com/docs/en/permissions),
[Settings](https://code.claude.com/docs/en/settings).

### SessionStart hook

`.claude/hooks/session-start.sh` runs when a **cloud** session starts. It runs `npm install`, so
`npm run check` and the tests work straight away. It does nothing on your own computer. It runs
synchronously: the session starts once dependencies are installed, which avoids Claude running
tests before they are ready, at the cost of a slower start. The brief says correctness must never
depend on a hook; `npm run check` is the gate.

Docs: [Hooks](https://code.claude.com/docs/en/hooks).

## `CLAUDE.md` files

- `CLAUDE.md` (root, under 200 lines): commands, architecture, content rules, mobile rules, the
  definition of done, and "never weaken or delete a test to make it pass". Claude reads it at the
  start of every session in this repo.
- `labs/CLAUDE.md`: the tutor rule. Claude loads it when it works on files in `labs/`.

Docs: [Memory and CLAUDE.md](https://code.claude.com/docs/en/memory).

## Subagents (`.claude/agents/`)

A subagent is a helper Claude can hand a focused job to. It has its own instructions and a limited
set of tools.

| Agent | Tools | Job |
| --- | --- | --- |
| `fact-checker` | Read, search, web fetch and search only | Checks every lesson claim against the PostgreSQL docs and the free sources. Reports; never edits. |
| `mobile-qa` | Read, search, shell | Runs the mobile end-to-end tests, looks at screenshots at 360 and 390 px, and reports layout and keyboard problems. |
| `grader-breaker` | Read, search, shell, edit | Attacks each grader: a plausible wrong answer must fail, a correct answer written differently must pass. Adds those cases as tests. |

`fact-checker` and `grader-breaker` run on every module before it is called done. To use one,
ask, for example: "Use the fact-checker agent on Module 1."

Docs: [Subagents](https://code.claude.com/docs/en/sub-agents).

## Skills (`.claude/skills/`)

A skill is a saved set of instructions that Claude loads when the task matches, or when you type
`/<name>`.

- `new-lesson`: lesson template and checklist.
- `new-challenge`: challenge format, how to pick a grader, the tests each challenge needs.
- `milestone-check`: runs the checks, updates `docs/PROGRESS.md` and stops for review. It runs
  only when you type `/milestone-check`, so Claude never decides on its own that a milestone is
  finished.

Docs: [Skills](https://code.claude.com/docs/en/skills).

## Output style for studying

When you study in `labs/` from a terminal, run:

```
/output-style Learning
```

The Learning style adds short explanations and leaves `TODO(human)` markers where you should
write the key code yourself. It is saved to `.claude/settings.local.json`, which is not committed,
so build sessions keep the default style. Run `/output-style Default` to switch back.

Docs: [Output styles](https://code.claude.com/docs/en/output-styles).

## The mod (Milestone 7, optional)

A mod is a plugin of hooks that draws in the terminal or the desktop Code tab, for example a
status-line entry. It needs Claude Code 2.1.287 or later, and it draws nothing in cloud sessions.
Milestone 0 ran in a cloud session, so no mod was built. Milestone 7 builds one only if that
session is a terminal or desktop session on a new enough version. It would show the current
milestone and whether the last `npm run check` passed, plus a `/milestone` command. Otherwise
Milestone 7 skips it and records why here.

## Cloud environment and its variables

The build sessions run in the same Claude cloud environment as your `for-edith` project, so the
container has that project's variables. These include a Supabase database URL and keys, ICD API
credentials and a PHI encryption key. **This project uses none of them.** The brief rules out a
backend and keys in the app, and the course uses only synthetic data. `CLAUDE.md` tells Claude
never to use them here.

Recommended: make a separate cloud environment for this repo with no secrets (no Supabase, ICD
or PHI variables), with network access that allows the package managers. A session in this repo
then cannot reach a database that may hold real patient data, even by mistake. You can do this in
the environment settings: open the environment menu in a session's title bar, then **Edit** or
**New environment**. Docs:
[cloud environments](https://code.claude.com/docs/en/cloud-environments).
