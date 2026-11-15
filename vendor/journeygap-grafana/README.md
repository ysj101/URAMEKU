# JourneyGap Grafana distribution

Source: https://github.com/ysj101/journeygap-grafana
Pinned source commit: `93bd2aabcdb8801b3510d4569b6e86ee06c74a6d` (GitHub PR #4).
Version: 0.1.0 (private, unpublished). License: Apache-2.0.

This archive is the unmodified output of `npm pack --ignore-scripts` after
`npm ci --ignore-scripts && npm run build` on that commit (Node 26.12.0).
It bundles the unpublished JourneyGap core/web packages from the upstream
exporter API change merged in ysj101/jorney_gap#42. Published Faro and OpenTelemetry
transitives are installed from the public registry using package-lock.json.
The browser application has one direct telemetry dependency. No package was published.

Regenerate with `sh scripts/repack_journeygap.sh`. Review the source, archive
SHA256SUMS and lockfile, then run the browser acceptance tests before updating.
