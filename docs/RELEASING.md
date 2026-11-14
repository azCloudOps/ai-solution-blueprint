# Releasing

Minor releases ship on the first Tuesday of each month. Patch releases ship as needed.

## Monthly checklist

1. Work through the "Knowledge base review" issue opened on the 25th.
   - Run `node scripts/check-kb.mjs --list` and confirm each flagged service name against the provider's documentation. Set `"verify": false` only for entries you confirmed this cycle, and note the source in the pull request.
   - Check provider release notes and major events from the month (Ignite, re:Invent, Google Cloud Next, Build, KubeCon) for renames, retirements and general availability changes.
   - Check the frameworks: OWASP Top 10 for LLM Applications, NIST AI RMF profiles, EU AI Act implementation dates, FOCUS specification.
2. Bump `kbVersion` (YYYY.MM.0) and `lastReviewed` in `kb/knowledge-base.json`.
3. Bump `version` in `package.json` and `ENGINE_VERSION` in `src/engine.js`.
4. Move "Unreleased" entries in `CHANGELOG.md` under the new version and date.
5. `npm run check`, then open `dist/index.html` and click through all eight steps on desktop and mobile widths.
6. Merge to `main`, then tag: `git tag vX.Y.0 && git push origin vX.Y.0`.
7. The release workflow tests, builds and publishes the GitHub Release with `ai-solution-blueprint.html` attached. The Pages workflow redeploys the hosted app.
8. Publish the release post on azcloudops.org and LinkedIn, and update the version shown on the Products page.

## Patch releases

Fix on a branch, add a CHANGELOG entry, bump the patch version, merge, tag `vX.Y.Z`.
