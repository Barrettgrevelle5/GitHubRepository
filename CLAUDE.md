# MainRepository — Global Agent Instructions

## Repository Layout

This repo contains multiple projects under `projects/`. Each project has its own `CLAUDE.md` with project-specific instructions. Read the relevant project's `CLAUDE.md` before starting work.

## General Rules

- Never modify files in any `ground_truth/` folder — those are read-only benchmarks
- All agent output goes to designated output folders that are safe to delete and regenerate
- Prefer `.xlsx` over `.xlsb` for any Excel files — better Python library support
- When extracting data from PDFs, always validate against known data before scaling
- Commit meaningful messages describing what changed and why
