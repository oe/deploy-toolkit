# Changelog

## 0.2.0 (unreleased)

### Migration

- Minimum Node.js version is now 22.12 (previously 8).
- `runShellCmd` defaults to `shell: false`. Pass `{ shell: true }` for shell expressions; normal command/argument calls preserve literal values. Failures now reject with `Error` objects.
- SSH command success requires exit code 0. Stderr warnings on successful commands no longer fail deployment. Signals and absent exit status are failures.
- Script portions now use `set -e`. Handle expected command failures explicitly or allow failure on the whole action.
- Glob uploads reject files outside `srcPrefix` and empty matches. Remote paths use POSIX separators.
- pnpm 12 replaces Yarn/npm as the locked development workflow. Run `pnpm install --frozen-lockfile` after checkout and `pnpm build` before importing locally.
- The package now offers ESM/CommonJS entry points with corresponding declarations. Use the public package entry; internal dist paths are not public exports.

### Fixes and maintenance

- Preserve SSH, command argument, and command option configurations across deployments.
- Dispose SSH clients even after connection failure.
- Clean local and remote temporary scripts, safely quote cwd, preserve cwd across transfer portions, and trim directive paths.
- Correct ancestor lookup for arrays of candidate filenames and relative starting paths.
- Detect unsuccessful directory uploads and support literal filenames containing glob syntax.
- Update node-ssh/glob/TypeScript and remove unused Babel, TSLint, Husky, Travis, and automatic publication/tagging hooks.
- Build with TypeScript 7 and Vite 8 library mode, producing ESM/CommonJS bundles, source maps, and declarations.
- Run the 21 regression tests in Vitest 5 with strict TypeScript checking.
- Update Node 22 type definitions and lock both node-ssh and the local SSH test server to ssh2 1.17.0.
- Add an offline tarball consumer check for both runtimes and NodeNext declarations.
- Add Node 22/24 CI, regression tests, and monthly grouped dependency updates.
