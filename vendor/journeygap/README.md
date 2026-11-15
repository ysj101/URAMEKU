# JourneyGap source packages

Upstream: https://github.com/ysj101/jorney_gap

Pinned commit: `96c01aaeccd022c556f64fff5a4777604446734a`.
Version: 0.1.0. License: Apache-2.0 (see LICENSE, also included in each package).

The upstream packages are not published. These archives are the unmodified output
of `pnpm pack` after `pnpm install --frozen-lockfile && pnpm build` on that commit,
using Node 26.12.1 and pnpm 10.30.2. pnpm resolves `workspace:*` to 0.1.0 during
packing. npm uses the local core archive to satisfy the Web/Relay dependency.
Web and core are runtime dependencies; Relay is development-only and never
imported by the browser application. No packages were published.

Regenerate with `sh scripts/repack_journeygap.sh`, then review archive contents,
SHA256SUMS and the lockfile. `npm ci` needs only the committed archives and the
public registry for their published dependencies; no sibling checkout is needed.

Keep the exact OpenTelemetry dependency versions: the Web exporter uses a
version-sensitive transport adapter. Upgrades require browser acceptance tests.
The source archive is available at:
https://github.com/ysj101/jorney_gap/archive/96c01aaeccd022c556f64fff5a4777604446734a.tar.gz
