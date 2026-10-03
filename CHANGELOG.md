# Changelog

## 0.2.0 (unreleased)

### Migration

- Minimum Node.js version is now 22 (previously 8).
- `runShellCmd` defaults to `shell: false`. Pass `{ shell: true }` for shell expressions; normal command/argument calls preserve literal values. Failures now reject with `Error` objects.
- SSH command success requires exit code 0. Stderr warnings on successful commands no longer fail deployment. Signals and absent exit status are failures.
- Script portions now use `set -e`. Handle expected command failures explicitly or allow failure on the whole action.
- Glob uploads reject files outside `srcPrefix` and empty matches. Remote paths use POSIX separators.
- npm replaces Yarn as the repository's locked development workflow. Run `npm ci` after checkout and `npm run build` before importing locally.

### Fixes and maintenance

- Preserve SSH, command argument, and command option configurations across deployments.
- Dispose SSH clients even after connection failure.
- Clean local and remote temporary scripts, safely quote cwd, preserve cwd across transfer portions, and trim directive paths.
- Correct ancestor lookup for arrays of candidate filenames and relative starting paths.
- Detect unsuccessful directory uploads and support literal filenames containing glob syntax.
- Update node-ssh/glob/TypeScript and remove unused Babel, TSLint, Husky, Travis, and automatic publication/tagging hooks.
- Generate a complete package with JavaScript and declaration files, including script/command helpers.
- Add Node 22/24 CI, regression tests, and monthly grouped dependency updates.
