# Changelog

## 0.2.1 (2026-10-04)

- Add opt-in plain shell scripts with `parseTransfers: false`, preserving here-doc text and shell state without interpreting UPLOAD/DOWNLOAD lines. Transfer parsing remains enabled by default.
- Add `shellArgs` for literal interpreter arguments and `env` for literal environment values available at interpreter startup and in child processes. Keep existing shell/shebang priority; reject nonempty shellArgs combined with a shebang.
- Add `timeoutMs` as a shared execution budget across shell portions, excluding transfers and cleanup. It requires remote GNU-compatible timeout, terminates ordinary process groups, and escalates to kill after a one-second grace period. Existing configurations have no timeout and need no additional utility.
- Normalize CRLF script line endings and retain relative/absolute/home cwd behavior, failure handling, configuration reuse, and temporary-file cleanup.

## 0.2.0 (2026-10-03)

### Migration

- Runtime support is now Node.js 20 or 22 and later (previously 8). The upgraded runtime dependencies require Node 20; development tools require Node 22.12 or later.
- SSH command success requires exit code 0. Stderr warnings on successful commands no longer fail deployment. Signals, absent exit status, and failed changes of directory are failures. `allowFailure` still continues the action sequence.
- Script portions now use `set -e`. Handle expected command failures explicitly or allow failure on the whole action; shell conditions and pipelines retain their usual semantics.
- Glob uploads reject files outside `srcPrefix`; remote paths use POSIX separators. Empty matches continue to fail. A pattern matching one directory retains recursive upload behavior.
- pnpm 12 replaces Yarn/npm as the locked development workflow. Run `pnpm install --frozen-lockfile` after checkout and `pnpm build` before importing locally.

### Compatibility preserved

- `runShellCmd` still defaults to `shell: true` and rejects with strings. Explicit `shell: false` passes argument values literally; internal Git operations use this mode.
- Keep CommonJS and ESM named imports, support the legacy ESM default API object, and retain `dist/*` and `package.json` imports with matching declarations.
- Public command arrays and argument arrays remain mutable; execution does not mutate them.
- Retain five concurrent directory transfers and parallel file-list uploads instead of adopting node-ssh's new serial default.

### Fixes and maintenance

- Preserve SSH, command argument, and command option configurations across deployments; dispose clients even after connection failure.
- Clean local and remote temporary scripts, safely quote cwd, preserve cwd (including trailing spaces) across transfer portions, and trim directive paths.
- Correct ancestor lookup for arrays of candidate filenames and relative starting paths.
- Detect unsuccessful directory uploads and support literal filenames containing glob syntax.
- Wait for local processes to close, handle inherited stdio, and decode UTF-8 split across output chunks correctly.
- Load SSH and glob dependencies when used, reducing cold import overhead for local utilities.
- Update node-ssh 13.2.1, glob 13.0.6, and ssh2 1.17.0; remove unused Babel, TSLint, Husky, Travis, and automatic publication/tagging hooks.
- Adopt pnpm 12.8.1, TypeScript 7.0.2, Vite 8.3.2 library mode, and Vitest 5.0.3; generate ESM/CommonJS bundles, source maps, and declarations.
- Add 24 regression tests, strict type checks, and isolated tarball checks for both runtimes, legacy imports, and NodeNext declarations.
- Add Node 22.12/22/24 build/test CI and a Node 20 package consumer check.
