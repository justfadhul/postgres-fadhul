# Codespace labs

Some labs need a real machine: two database sessions at once, write-ahead log archiving and
recovery, replication between servers, the Node API lab and the Go storage engine. They run in a
GitHub Codespace built from `.devcontainer/` (Node LTS, Go, PostgreSQL 18, Docker-in-Docker).

## Start

1. On the repository page, choose **Code → Codespaces → Create codespace on the default branch**
   (each lab page in the course has an "Open in Codespaces" button that does this).
2. Wait for setup to finish. PostgreSQL 18 starts on its own; `psql` connects to the `labs`
   database with no flags.
3. Check the tools: `make check LAB=env-check`.

## Stop when you finish

A free personal account gets 120 core-hours and 15 GB of storage a month. This codespace uses
2 cores, so that is **60 hours a month**. Stop it when you finish a session: in the Codespaces
list choose **⋯ → Stop codespace**, or run `gh codespace stop`. Codespaces also stop after 30
minutes idle by default, but stopping yourself saves hours.

## Lab checker

`make check LAB=<id>` runs a lab's tests. From Milestone 3 it prints a short completion code that
you type into the course site to mark the lab done. Labs ship tests and scaffolding only, never
solutions.

## Studying with Claude Code

In this folder Claude acts as a tutor (see `CLAUDE.md` here). For the best practice, run
`/output-style Learning` so Claude asks you to write the key code yourself.
