# AGENT.md

## Release Process

1. Verify local changes and branch.
   - `git status --short`
   - `git branch --show-current`
2. Run quick sanity checks before release.
   - `node --check script.js`
   - Confirm required files exist: `index.html`, `styles.css`, `script.js`, `data/*`
3. Update release docs.
   - Add detailed technical notes to `CHANGE_LOG.md`
   - Add end-user summary to `RELEASE.md`
   - Update `README.md` if setup/behavior changed
4. Commit release changes.
   - `git add .`
   - `git commit -m "<release message>"`
5. Push to production branch.
   - `git push origin main`
6. Verify GitHub Pages deployment.
   - Site: `https://longtngo.github.io/letter-trail/`
   - Wait 1-3 minutes for propagation
   - Hard refresh browser after deploy
7. Record release metadata.
   - Commit hash
   - Release date
   - Previous deployed commit

## Notes

- Do not open from `file://`; use a static server (example: `npx --yes http-server . -p 3000`).
- Keep release notes high-level for users in `RELEASE.md`.
- Keep implementation details in `CHANGE_LOG.md`.
