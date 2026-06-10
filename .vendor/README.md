# Vendor Tarballs

This directory contains private npm package tarballs that pnpm/npm cannot fetch
directly from our private Nexus registry due to upstream HTTP protocol
incompatibility (manifest endpoint returns malformed responses for npm clients
while curl works fine).

These tarballs are referenced via `file:` overrides in `pnpm-workspace.yaml`:

```yaml
overrides:
  '@tryghost/koenig-lexical': 'file:./.vendor/koenig-lexical-1.7.20-poll.31.tgz'
```

## Files

- `koenig-lexical-1.7.20-poll.31.tgz` — Ghost editor Lexical bundle, custom poll-feature fork

## Upgrading

When a new version is published to Nexus:

1. Download the new tarball (curl works fine, only npm/pnpm has the bug):
   ```bash
   curl -L -o .vendor/koenig-lexical-<NEW_VERSION>.tgz \
     'http://ratus-dnat-.../repository/npm-hosted1/@tryghost/koenig-lexical/-/koenig-lexical-<NEW_VERSION>.tgz'
   ```

2. Update `pnpm-workspace.yaml`:
   ```yaml
   overrides:
     '@tryghost/koenig-lexical': 'file:./.vendor/koenig-lexical-<NEW_VERSION>.tgz'
   ```

3. Remove the old `.tgz`, then reinstall:
   ```bash
   rm .vendor/koenig-lexical-<OLD_VERSION>.tgz
   rm pnpm-lock.yaml
   pnpm install
   ```

4. Commit both the new `.tgz` and updated `pnpm-workspace.yaml` + `pnpm-lock.yaml`.
