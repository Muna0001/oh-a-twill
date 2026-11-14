# Rules for every wave 3 agent

You are working in /home/user/oh-a-twill, an Expo SDK 58 / React Native 0.88 / React 19 app released web first. Read `CLAUDE.md`, then the `PLAN.md` sections your brief names.

Everything below the screens is finished. Read before coding: `src/ui/index.ts` and its component files, `src/weave/index.ts`, `src/catalog/index.ts`, `src/engine`, `src/store/index.ts`, `src/media/index.ts`, `src/platform`. Use the existing primitives; do not restyle from scratch.

Shared workspace (three other agents are working in the same directory on other folders):

- Edit only the paths your brief lists. Keep the exported names; the route files in `src/app` import them and are fixed.
- Do not run any git command that changes state. Do not install packages.
- Navigation: `router` / `Link` from `expo-router`. Routes: `/` (library tab), `/projects`, `/settings`, `/stitch/<id>`, `/project/new?stitch=<id>` (setup sheet, modal), `/project/<id>` (the guide), `/project/<id>/setup` (modal).
- Verify with scoped commands: `npx jest <your folder>`, `npx eslint <your folder>`, `npx tsc --noEmit` (other agents' unfinished files may error outside your folder; only your files matter).
- Visual check: `npm run web:export`, `node scripts/serve-dist.mjs <your port>`, Playwright (`require('playwright')`) screenshots at 390×844 and 1280×800, light and dark, saved under `/tmp/claude-0/-home-user-oh-a-twill/75cbfee9-8315-5c39-8d91-e1ec5c07efa9/scratchpad/<wp>/`. Look at them and fix what is off. If the export fails because of another agent's half-written file, wait a minute and retry; do not fix their files. Kill your server when done.
- To seed data for screenshots, write localStorage before load: the stores persist under `oh-a-twill/v1/projects` and `oh-a-twill/v1/settings` (AsyncStorage is localStorage on web; see `src/store/projects.ts` and `storage.ts` for the JSON shape).
- Tests: RNTL v14 is async. Mock `expo-router` with a `jest.fn` router to assert navigation.
- Strings go in a `copy.ts` in your folder, verbatim from `reference/web/index.html` where they exist. US spelling ("Color", "Favorites"), typographic apostrophes.
- Final report (short): what was built, anything missing or awkward in another layer (do not edit it; report it), anything not done.
