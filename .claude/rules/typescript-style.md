---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript style

- Server is `strict`. Client `tsconfig.json` has `strict: false` today: write new client code as if it were strict.
- No `any`, no `@ts-ignore`; use `unknown` and narrow.
- Type every parameter and return value of exported functions.
- Named exports only, except Next.js files that require a default export (`page.tsx`, `layout.tsx`).
- Arrow functions for services, controllers, repositories, hooks and components: `export const name = async () => {}`.
- Style: single quotes, semicolons, 2-space indent, trailing commas in multiline lists, parentheses around arrow params. (Older user-app and server files use double quotes; do not reformat untouched files just for style.)
- `console.log` is not allowed in committed code (`console.error` in a catch that swallows an error on purpose is fine).
- Unused params are prefixed with `_` (`_req`, `_res`).
- Names, comments and API messages in English. Comment the *why*, not the *what*.
- Finish with `npm run typecheck` and `npm run lint` clean in the workspace you touched (add the script if it is missing).
