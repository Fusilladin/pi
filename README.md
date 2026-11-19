# Unofficial Pi fork

Unofficial maintenance kit and runtime bundle by Fusilladin, based on earendil-works/pi v1.5.2. No upstream source patches. MIT LICENSE and upstream dependency notices are retained; Node.js licensing is in NODE-LICENSE in the bundle.

The runtime contains the SHA-verified Node.js 22.23.3 executable and production npm dependencies from upstream's SHA-verified 1.5.2 install package and lockfile. Lifecycle scripts are disabled. Debian x86_64 GNU only. Runtime prerequisites: libstdc++6 and glibc.

Run maintenance with Node 24:

```
node fork/bin/forkctl.mjs install --home "$HOME" --archive FILE --sha256 HASH
node fork/bin/forkctl.mjs status --home "$HOME"
node fork/bin/forkctl.mjs rollback --home "$HOME" --version 1.2.0-original
node fork/bin/forkctl.mjs run --home "$HOME" --version 1.2.0-original --isolated
node fork/bin/forkctl.mjs recover --home "$HOME"
```

First adoption retains the existing 1.2.0 runtime by reference and saves the original launcher. Every new runtime uses a fresh directory and atomically switched symlinks. Existing processes keep their old executable and modules. No existing runtime or configuration is overwritten.

Plain pi selects the approved default runtime and uses normal Pi configuration. local-noweb stays pinned to 1.2.0-original until explicitly changed. It creates isolated agent/session directories, selects only the loopback Strata provider and model qwen3.8-flash-next-iq3_xxs, disables automatic extensions/MCP/skills, and keeps only the explicitly supplied Jev guard. Provider configuration is generated without reading existing models or authentication files. Tools are read,bash,edit,write,grep,find,ls. This removes search features; shell tools retain their usual network capability.

```
node fork/bin/forkctl.mjs profile-init --home "$HOME" --guard /absolute/path/to/jev-guard.ts
node fork/bin/forkctl.mjs profile-run --home "$HOME" -- --print "Say hello"
node fork/bin/forkctl.mjs profile-set-version --home "$HOME" --version 1.5.2-p3
```

The source fork is maintained privately as a standalone repository before visibility is changed. GitHub public forks cannot be made private. Upstream refs remain available through the upstream remote in the maintenance checkout. No automatic bot pushes are enabled. Publish remains an explicit owner command after exact-commit approval and Linux install/update/rollback evidence.

Additional supply verification: upstream's install lock omits integrity for eight first-party Pi packages. fork/npm-supplemental-pins.json pins their exact registry tarballs. Runtime assembly verifies all 2,832 first-party files against those SHA512/SHA256-checked archives. Other dependencies retain the release lock's integrity checks.

Build using prepared, SHA-verified upstream supply files plus npm-firstparty tarballs:

```
node fork/bin/forkctl.mjs build --supply SUPPLY_DIR --stage NEW_STAGE --output NEW_OUTPUT --offline
```

The distributed runtime has 267 raw privacy-pattern matches, all precisely classified as unchanged public upstream literals. fork/runtime-literals.json binds each match to its archive hash, filename, whole-file hash, exact offset, length, match digest and authenticated source archive. The blocklist remains unchanged. Unknown matches fail closed. No license attribution is removed.

Release 1.5.2-p3: maintenance publisher uses compatible paginated draft discovery and exact-input publication checks. Upstream runtime source and patches remain pinned.
