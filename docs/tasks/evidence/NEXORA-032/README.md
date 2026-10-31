# NEXORA-032 reference evidence

These PNGs show the **external ZIP account subtree**, not production Nexora data.
The source contains fictional name/code/VIP/wallet and four additional demo actions;
they are intentionally absent from the product. No mock fields or source scripts
are imported by a production route. See the [task](../../active/NEXORA-032-account-menu-zip-parity.md).

Reference archive SHA-256 is a10065b309004c8771ad937d2f622a7f93e44ef9a496599e7cfc637e198151aa;
Header source47e699e467c5fbf4cf8cdddecda1647846866a9ccb6f728c279bfca0f8bcf39c.
Only the exact Account JSX fragment was rendered in an isolated frame with the
reference CSS, original mockData constants and local Inter. No ZIP package scripts,
App, sourcing/shipping scope or provider services executed. Reference and source
hashes, viewport geometry and per-PNG hashes are in reference.json.

Captured closed/open/logout-hover at1440x900,1280x800,1024x768,768x1024,390x844,375x812.
Actual fine-mouse input capability and CDP pointer movement enable the source's
Tailwind hover media query; no inline hover styles or forced pseudo-state used.
An earlier headless capture had hover:none and was rejected as hover evidence.

Compare panel256/radius12, header16/avatar40, row32/icon16/font12/padding8x12/gap10,
color/hover/shadow and anchoring. Deliberate differences: true Nexora username and
neutral subtitle; no VIP/wallet/code/extra demo entries; two planned disabled rows;
canonical40px trigger instead of arbitrary ZIP42; shorter196px normal panel instead
of full mock menu385. Runtime Account screenshots are attached to the new PR's
final-head account-menu-evidence artifact; no pixel-equality assertion is claimed.
