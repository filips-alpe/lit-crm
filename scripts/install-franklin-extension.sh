#!/bin/sh
# Installs the franklin extension (demo renderers and per-user dashboards) from
# lit-crm-seeds at a pinned commit. Run by vercel-build before migrations, so a failed
# download stops the deploy before the database changes. Bump SEEDS_REF to ship a newer one.
set -eu
SEEDS_REF=31f087910cc2735ac6e631f048e443ea3fd010c5
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
curl -fsSL "https://codeload.github.com/filips-alpe/lit-crm-seeds/tar.gz/$SEEDS_REF" | tar xz -C "$dir" --strip-components 1
bun run ext install "$dir" --path extension --force
