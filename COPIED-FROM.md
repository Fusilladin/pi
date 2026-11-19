# Copied Codex maintenance files

Source: sibling staged codex-fork; hashes before adaptation.

- `install.mjs`: `6e885f5b7c056845dcf1ac22acc90cddc88255242b172ffe35d8e4b7b8780a36`
- `safe-extract.mjs`: `2a9448e95c8539dfad7bdcc54f9a9ff4109b8b2da36cf39e40081f7f18d00786`
- `state.mjs`: `415d8d05869a54b33b27a4827a07bbdbf7f32dfd470fb8ee82059d9385e22fa1`
- `canary.mjs`: `7c649906138cbc9d533646ff5e751cbf182c48d7f8bb7823e5d8ad6877fc9a96`
- `release.mjs`: `0ac4d09e72420fae3a3efdf418064055658447d3f25380e4996e3a121bc3038e`
- `publish.mjs`: `82ab8ae4c4c37fae2e51cc549f1679d61210d3b52499626de040fef375cae62e` (copied unchanged)

Publish hardening (p4 staging): copied without cross-tree imports.
- `fork/lib/publish.mjs`: `660323d3431ea08f01c6504e2c9512124f1b349fbdf4c4064cf1efe2dd1788bc` (Codex source, copied unchanged)
- `tests/publish.test.mjs`: `aec970a2b6512fc4227c508477625696a4e0bdded0d65bce756053ba6e09ff24` (Codex source, copied unchanged)

Release 1.5.2-p3 retains the hardened copied publisher and tests. Final source hashes (before Pi-specific adaptation; these two copies are unchanged):
- `fork/lib/publish.mjs`: `660323d3431ea08f01c6504e2c9512124f1b349fbdf4c4064cf1efe2dd1788bc`
- `tests/publish.test.mjs`: `aec970a2b6512fc4227c508477625696a4e0bdded0d65bce756053ba6e09ff24`
