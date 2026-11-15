# Changelog

What changed and when, newest first. This project does not have numbered releases, so the entries are grouped by month.

## 2026-11

- Next.js updated to 16.4.6. Lint-tool advisories cleared with a pinned `minimatch`.

## 2026-10

- Fixed a critical Next.js image-generation vulnerability (16.3.5 to 16.3.8). The lockfile needed two Linux-only entries added by hand so the build works on the CI machine.
- Declared the Node version the tests run on. Zod updated to a patched version.

## 2026-09

- The README opens with one real finding and a screenshot of the approval gate refusing the agent.
- The lockfile now includes the Linux-only entries, and CI installs from it exactly.
- Lint errors fixed and lint added to the build gate. Tests pin the engine's claims and the approval gate.

## 2026-07

- First version: a regulatory-change remediation helper (DORA demo) where the agent maps, groups and drafts, and a person approves every group.
