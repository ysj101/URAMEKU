# Title decoration QA — 2026-10-30

final result: passed

## Scope and sources

Selected visual: first displayed ideation result, paper strip with curled red reverse.
Source visual truth: qa/title-peeled-reference.png
Implementation: http://127.0.0.1:5174/#/
State: home, no saved case progress.
Screenshots: qa/title-peeled-desktop.png, qa/title-peeled-detail.png, qa/title-peeled-mobile.png.

## Comparison evidence

Source: 2027 × 776 raster, approximately 1037 × 397 logical design size.
Desktop: 1280 × 720 CSS viewport, devicePixelRatio 1. Focused title/masthead/tagline crop: 1040 × 397 pixels. Source and focused implementation were opened together in one comparison tool result; compare their near-identical aspect ratios, normalizing the source visually to the focused crop width.
Mobile: 390 × 844 CSS viewport, devicePixelRatio 1; browser screenshot includes the browser's 375-pixel content surface. DOM reports innerWidth 390 and home width 347, with document scrollWidth 375 (no horizontal overflow).
The full desktop screenshot verifies the title in the existing page context. The focused crop verifies readable title shapes, torn edges, ink wear, and the red underside. Mobile screenshot verifies the complete four-character title and curl remain visible.

## Required fidelity surfaces

- Typography: four black characters retained in the raster, with comparable massive gothic shapes. Existing masthead and tagline fonts unchanged. Hidden live heading text preserves heading naming and route focus.
- Spacing/layout: centered wide strip, newspaper dividers, and generous whitespace retained. Asset uses 74% of available desktop width and 100% on narrow screens. Existing page layout outside the title preserved.
- Colors/tokens: opaque cream paper, black ink, muted red reverse; surrounding UI uses existing color tokens. No new UI palette.
- Image quality: transparent PNG, 2064 × 762, no stretched lettering. Object-fit removes exterior transparent padding; torn edges and curl stay intact. Generated isolated strip has slightly stronger paper texture and a wider red underside than the concept; acceptable within selected direction.
- Copy/content: title and tagline unchanged by this work. No new player-facing Japanese copy.

## Comparison history

- Initial browser check found title incorrectly confined to the right grid column after an insertion split a grouped selector (P1). Restored the shared full-width grid selector and scoped artwork sizing to the image. New screenshot shows centered full-width heading region.
- Console check found a React 18 warning from fetchPriority (P2). Removed the optional prop. Reloaded after correction; no subsequent errors in the log (earlier warning entries remain in browser history).
- Post-fix combined visual comparison: no actionable P0/P1/P2 findings.

## Interaction and automated checks

- Opened case list and returned home through visible buttons.
- Browser heading remains named ウラメク.
- Build passed.
- Existing App, accessibility, and assets suites: 24 tests passed.
- Wording lint: zero errors/warnings; wording baseline unchanged.
- Asset references and Python asset validation passed.
- qa/coverage.json reviewed; pending manual art/rights approval remains pending.

## Follow-up polish

- Generated title is registered as pending manual art review, not release-approved.
- Physical mobile devices were not tested; responsive browser viewport only.

## Asset generation record

Tool: built-in Image Gen, transparent background enabled.
Final asset: public/assets/branding/title-peeled.png.
Input: selected first displayed ideation image above.
Final prompt:

> Extract the exact central torn newspaper title strip from the attached approved-direction mockup as a standalone web logo raster asset on truly transparent background. Preserve the four large black Japanese characters exactly ウラメク, their weight and shapes, cream aged paper fiber texture, torn horizontal edges, left and right fragment newspaper rules, and bottom-right corner curl showing red printed reverse underside behind ク. Match this asset faithfully, do not redesign. Remove all surrounding page, masthead, tagline, horizontal page dividers, shadows outside strip except a very restrained natural paper contact shadow. Just ONE isolated long horizontal strip, no added objects/text. Tight natural wide canvas about 1500 x 360, asset occupies >95% of width with minimal transparent safety padding on edges. Keep all four letters crisp and easy to read. Transparent exterior, opaque cream paper. No white rectangular background. This is a pending-review project asset.

## Isolated PR verification

Reapplied only the title changes onto origin/main (d7aa29f), preserving other local work in the original checkout. Recaptured desktop/mobile evidence from this PR branch at port 5174 (the focused title crop is retained from the original title-only implementation; its appearance is unchanged); verified home-to-case-list navigation and return. Browser console errors: none. Build, the same 24 existing tests, wording lint, asset references, and asset validation (539 assets) all passed on the isolated branch. qa/coverage.json reviewed again; manual art approval remains pending.
