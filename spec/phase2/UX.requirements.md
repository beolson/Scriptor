# UX Requirements — Scriptor Documentation Website

Extracted from `ui/Variant1.pen` (dark mode x=0, light mode x=2300, mobile x=1640) and `FunctionalRequirements.md`. This document gives implementers everything needed: tokens, components, pages, interactions, and conventions.

---

## 0. Design Source & Verification

All UI components and screens are defined in **`ui/Variant1.pen`**. This file is the single source of truth for visual design. Implementers must use the **Pencil MCP client** to inspect and verify their implementations against the `.pen` file.

### Accessing the design

Open the file in the Pencil MCP client:

```
mcp__pencil__open_document({ filePathOrTemplate: "<repo-root>/ui/Variant1.pen" })
```

Or use `mcp__pencil__batch_get` to read specific nodes by ID:

```
mcp__pencil__batch_get({
  filePath: "ui/Variant1.pen",
  nodeIds: ["<node-id>"],
  readDepth: 3
})
```

### Verification workflow

After implementing a component or page, verify it against the design using the Pencil MCP client:

1. **Screenshot the design node** — `mcp__pencil__get_screenshot({ filePath: "ui/Variant1.pen", nodeId: "<node-id>" })` — to get the reference image.
2. **Inspect property values** — `mcp__pencil__batch_get` with the component's node ID to read exact colors, font sizes, spacing, and layout properties.
3. **Compare** your implementation to the screenshot and property values. Fix any discrepancies before marking the component complete.

### Node map

| Frame / Component | Pen name | Node ID |
|---|---|---|
| Component library | `__ components` | `0uQF8` |
| Homepage (desktop) | `homepage_desktop` | `kIl3i` |
| Platform listing — Windows (desktop) | `platform_windows_desktop` | `8PTul` |
| Platform listing — Linux (desktop) | `platform_linux_desktop` | `576mM` |
| Platform listing — macOS (desktop) | `platform_mac_desktop` | `M9XtD` |
| Script detail (desktop) | `script_detail_desktop` | `rK8aO` |
| Homepage (mobile) | `homepage_mobile` | `gVj9a` |
| Platform listing (mobile) | `platform_listing_mobile` | `Ox3IY` |
| Script detail (mobile) | `script_detail_mobile` | `dWPZd` |

> **Dark vs light:** The base components in `__ components` (`0uQF8`) use a dark palette. The `lm_` prefixed refs in the same frame are the **light-mode overrides** that implementers must match — light mode is the only shipped design.

---

## 1. Aesthetic & Branding

- **Terminal/CLI aesthetic**: light bg, white page background, monospace fonts throughout
- `>` prefix on headings (e.g. `> scriptor`, `> windows scripts`)
- `$` prefix for shell commands
- `//` comment-style labels (e.g. `// platforms`, `// arch:`)
- Bracket tags for metadata (e.g. `[x86]`, `[arm64]`, `[copy]`)
- Platform CLI prompts: `C:\` (Windows), `$` (Linux), `%` (macOS)
- All visible text is **lowercase** (terminal convention)

---

## 2. Color Tokens

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#FFFFFF` | Page background, nav, hero |
| `--color-surface` | `#F9FAFB` | Component panel bg |
| `--color-border` | `#E5E7EB` | All borders and dividers |
| `--color-text-primary` | `#111111` | Headings, values, body |
| `--color-text-muted` | `#6B7280` | Labels, descriptions, captions |
| `--color-accent` | `#059669` | Links, code text, active states |

> **Pen reference:** Inspect `lm_comp_nav_bar` (`oZMJy`) and `lm_comp_code_block` (`NV4xD`) in `ui/Variant1.pen` to verify fill and stroke values against these tokens.

---

## 3. Typography Tokens

Two font families only:

- **JetBrains Mono** — headings, nav logo, buttons, code blocks, script names, `>` prompt items
- **IBM Plex Mono** — descriptions, captions, metadata labels, body prose, badges

| Token | Size | Weight | Family | Usage |
|---|---|---|---|---|
| `--text-hero` | 48px desktop / 32px mobile | 700 | JetBrains Mono | Hero headline |
| `--text-h1` | 28px desktop / 22px mobile | 700 | JetBrains Mono | Page heading |
| `--text-h2` | 24px desktop / 18px mobile | 700 | JetBrains Mono | Section heading |
| `--text-h3` | 18px | 700 | JetBrains Mono | Subheadline |
| `--text-h4` | 16px | 700 | JetBrains Mono | Markdown headings, card headings |
| `--text-nav-logo` | 16px desktop / 14px mobile | 700 | JetBrains Mono | Nav brand |
| `--text-code` | 13px | normal | JetBrains Mono | Code block commands |
| `--text-nav-link` | 13px | normal | JetBrains Mono | Nav links, footer links |
| `--text-body-lg` | 18px | normal | IBM Plex Mono | Hero subheadline |
| `--text-body` | 14px | normal | IBM Plex Mono | Script count, mobile subheadline |
| `--text-label` | 13px | normal | IBM Plex Mono | Code descriptions, spec prose |
| `--text-caption` | 12px | normal | IBM/JetBrains | Breadcrumb, filter tabs, metadata |
| `--text-micro` | 11px | normal | IBM Plex Mono | Badges, dep tags, mobile notes |
| `--text-script-name` | 14px | 500 | JetBrains Mono | Script row name |

---

## 4. Spacing & Layout Tokens

| Token | Value | Usage |
|---|---|---|
| `--page-max-width` | 1440px | Desktop canvas width |
| `--page-px-desktop` | 120px | Horizontal page padding |
| `--page-px-mobile` | 24px | Horizontal mobile padding |
| `--hero-py` | 80px | Hero section vertical padding |
| `--section-py` | 60px | Platform section vertical padding |
| `--header-py` | 48px desktop / 32px mobile | Page header vertical padding |
| `--body-py` | 48px | Detail body vertical padding |
| `--nav-h` | 56px | Nav bar height |
| `--footer-h` | 80px | Footer height (desktop) |
| `--gap-xs` | 6px | Breadcrumb segments |
| `--gap-sm` | 8px | Badge row, dep tag row |
| `--gap-md` | 12px | Header/card internal gap |
| `--gap-lg` | 16px | Platform card grid, filter tabs |
| `--gap-xl` | 24px | Platform section gap |
| `--gap-2xl` | 32px | Nav links, section spacing |
| `--gap-3xl` | 48px | Detail body col gap |
| `--code-block-px` | 20px | Code block horizontal padding |
| `--code-block-py` | 16px | Code block vertical padding |
| `--card-p` | 24px | Platform card padding |
| `--badge-py` | 4px | Badge/tag vertical padding |
| `--badge-px` | 6px | Badge/tag horizontal padding |
| `--btn-py` | 10px | CTA button vertical padding |
| `--btn-px` | 16px | CTA button horizontal padding |
| `--meta-py` | 10px | Metadata row vertical padding |

---

## 5. Components

> For every component below, use the Pencil MCP client to get the exact reference:
> ```
> mcp__pencil__get_screenshot({ filePath: "ui/Variant1.pen", nodeId: "<node-id>" })
> mcp__pencil__batch_get({ filePath: "ui/Variant1.pen", nodeIds: ["<node-id>"], readDepth: 3 })
> ```

---

### NavBar

> **Pen node:** `lm_comp_nav_bar` — ID `oZMJy` (light mode ref of `ANshg`)

- Full-width, `--nav-h` (56px) height, sticky
- Background: `--color-bg`, bottom border: `--color-border`
- Left: logo `"> scriptor"` (`--text-nav-logo`, `--color-text-primary`)
- Right: `"github"` link (`--text-nav-link`, `--color-text-muted`)
- Horizontal padding: `--page-px-desktop` desktop / `--page-px-mobile` mobile

---

### Footer (Desktop)

> **Pen node:** `lm_comp_footer` — ID `5Bddv` (light mode ref of `QhPVI`)

- Full-width, `--footer-h` (80px) height
- Background: `--color-bg`, top border: `--color-border`
- Left: `"> scriptor // manage your scripts"` (IBM Plex Mono 13px, `--color-text-muted`)
- Right: `"github"` (JetBrains Mono 12px, `--color-text-muted`)

---

### Footer (Mobile)

> **Pen node:** `mobile_footer` within `homepage_mobile` — screen ID `gVj9a`, footer child ID `DlH2T`

- Vertical layout, padding `[32px, 24px]`
- Brand text on top, footer links row below

---

### CodeBlock

> **Pen node:** `lm_comp_code_block` — ID `NV4xD` (light mode ref of `IEp6k`)

- Border 1px all sides (`--color-border`)
- Header row (`justify: space-between`):
  - Language label e.g. `// powershell` (IBM Plex Mono 11px, `--color-text-muted`)
  - `[copy]` button (JetBrains Mono 12px, `--color-text-muted`)
- Command text: `--color-accent`, JetBrains Mono 13px, fixed-width text growth
- Padding: `--code-block-px` / `--code-block-py`
- Width: 400px default; 600px on listing/homepage desktop; full-width on mobile
- `[copy]` click copies command text to clipboard; label briefly changes to `[copied]` as feedback

---

### PlatformCard

> **Pen node:** `lm_comp_platform_card` — ID `dkIKB` (light mode ref of `83vWD`)

- Width: 300px (desktop grid) / `fill-container` (mobile)
- Border 1px all sides (`--color-border`), vertical layout, gap 12px, padding 24px
- `prompt_char`: CLI prompt character (IBM Plex Mono or JetBrains Mono 12px, `--color-text-muted`)
- `platform_name`: 18px bold, `--color-text-primary`
- `platform_desc`: IBM Plex Mono 13px, `--color-text-muted`, fixed-width text growth
- `"> view scripts"`: `--color-accent`, JetBrains Mono 12px
- Entire card is clickable → `/scripts/{platform}`

---

### ScriptRow

> **Pen node:** `lm_comp_script_row` — ID `P8pAa` (light mode ref of `gAmQi`)

- Full-width, bottom border only, horizontal layout
- `justify: space-between`, padding `[16px, 0]`, gap 16px
- Left (`fill-container`, vertical layout, gap 4px):
  - `script_name`: JetBrains Mono 14px weight 500, `--color-text-primary`
  - `script_desc`: IBM Plex Mono 12px, `--color-text-muted` (prefix `//`)
- Right (horizontal, gap 8px, vertically centered):
  - ArchBadge
  - `">>"` arrow (JetBrains Mono 12px, `--color-text-muted`)
- Entire row clickable → `/scripts/[id]`

---

### DistroGroupHeader

> **Pen node:** `lm_comp_distro_group_header` — ID `c1v1c` (light mode ref of `VswOa`)

- Full-width, bottom border only, padding `[12px, 0]`
- Label: e.g. `"// debian"`, IBM Plex Mono 12px, `--color-text-muted`, `letter-spacing: 1px`

---

### MetadataRow

> **Pen node:** `lm_comp_metadata_row` — ID `ItHPc` (light mode ref of `Fn9B6`)

- Full-width, bottom border only, `justify: space-between`, padding `[10px, 0]`
- Key: IBM Plex Mono 12px, `--color-text-muted`
- Value: IBM Plex Mono 12px, `--color-text-primary`

---

### ArchBadge / DependencyTag

> **Pen nodes:**
> - `comp_arch_badge` — ID `u1PM6`
> - `comp_dependency_tag` — ID `LUjW3`

- Padding: `[4px, 6px]`
- Text: IBM Plex Mono 11px, `--color-text-muted`
- Format: `[x86]`, `[arm64]`, `[curl]`

---

### Breadcrumb

> **Pen node:** `lm_comp_breadcrumb` — ID `kUgWo` (light mode ref of `uYndP`)

- Horizontal layout, gap 6px, `align-items: center`
- Segments: `home` > `scripts` > `active`
- IBM Plex Mono 12px; `--color-text-muted` for ancestor segments, `--color-text-primary` for active segment
- `">"` separator (IBM Plex Mono 12px, `--color-text-muted`)

---

### CtaButton

> **Pen node:** `lm_comp_cta_button` — ID `UpYZe` (light mode ref of `MiLvz`)

- Background: `--color-accent`, padding `[10px, 16px]`
- Text: JetBrains Mono 12px weight 500, dark text (`#0A0A0A`)

---

## 6. Pages

> For each page, use the Pencil MCP client to get a reference screenshot and inspect layout:
> ```
> mcp__pencil__get_screenshot({ filePath: "ui/Variant1.pen", nodeId: "<screen-id>" })
> mcp__pencil__snapshot_layout({ filePath: "ui/Variant1.pen", parentId: "<screen-id>", maxDepth: 3 })
> ```

---

### Homepage `/`

> **Pen nodes:** desktop `homepage_desktop` (`kIl3i`) · mobile `homepage_mobile` (`gVj9a`)

#### Desktop (1440px)

Sections top → bottom:

1. **NavBar** (`oZMJy`)
2. **Hero** (`padding [80px, 120px]`, vertical layout, gap 32px):
   - badge: `"// cross-platform script management"` (IBM Plex Mono 12px, `--color-text-muted`)
   - headline: `"> scriptor"` (`--text-hero` 48px, bold, `--color-text-primary`)
   - subheadline: IBM Plex Mono 18px, `--color-text-muted`
   - CodeBlock (600px, centered wrapper): OS-detected install command
   - note: `"// not on windows? → select your platform below"` (IBM Plex Mono 12px, `--color-text-muted`)
3. **Platforms section** (`padding [60px, 120px]`, vertical layout, gap 24px):
   - section_label: `"// platforms"` (IBM Plex Mono 12px, `--color-text-muted`)
   - heading: `"> browse by platform"` (`--text-h2` 24px, bold)
   - 3-column card grid (gap 16px): Windows / Linux / macOS PlatformCards

#### Mobile (390px)

> **Pen node:** `homepage_mobile` (`gVj9a`)

- `mobile_nav` (ID `r8hWV`): logo + github link only, padding `[0, 24px]`
- Hero (ID `pU9hj`, `padding [48px, 24px]`, gap 24px):
  - badge: IBM Plex Mono 11px
  - headline: JetBrains Mono 32px bold
  - subheadline: IBM Plex Mono 14px, fixed-width
  - CodeBlock: full-width
  - note: IBM Plex Mono 11px
- Platforms section (ID `6vRxb`, `padding [40px, 24px]`, gap 20px):
  - heading: JetBrains Mono 18px bold
  - PlatformCards: stacked vertically, full-width
- `mobile_footer` (ID `DlH2T`): vertical, `padding [32px, 24px]`

---

### Platform Listing `/scripts/{platform}`

> **Pen nodes:** desktop Windows `platform_windows_desktop` (`8PTul`) · Linux `platform_linux_desktop` (`576mM`) · macOS `platform_mac_desktop` (`M9XtD`) · mobile `platform_listing_mobile` (`Ox3IY`)

#### Desktop (1440px)

Sections top → bottom:

1. **NavBar** (`oZMJy`)
2. **Page header** (`padding [48px, 120px]`, bottom border, vertical layout, gap 12px):
   - Breadcrumb: `home > scripts > {platform}`
   - Heading: `"> {platform} scripts"` (`--text-h1` 28px, bold)
   - CodeBlock (600px, centered): platform install command
   - arch_filter row: `"// arch:"` label + `[any]` `[x86_64]` `[arm64]` tabs (JetBrains Mono 12px; active = `--color-accent`, inactive = `--color-text-muted`)
   - *(Linux only)* distro_filter row: `"// distro:"` + distro tabs
   - *(Linux only)* version_filter row: `"// version:"` + version tabs
   - count: `"// N scripts available"` (IBM Plex Mono 14px, `--color-text-muted`)
3. **Script list** (`padding [40px, 120px]`, vertical layout):
   - *(Linux)* DistroGroupHeader before each distro group
   - ScriptRow per script (alphabetical within group)
4. **Footer** (`5Bddv`)

> **Pen inspection tips:**
> - Windows page header: node `RXqC7` within `8PTul`
> - Linux distro/version filters: nodes `MTPyJ` and `2g1PD` within `576mM`
> - macOS arch filter (Apple Silicon / Intel): node `Sphm6` within `M9XtD`

#### Mobile (390px)

> **Pen node:** `platform_listing_mobile` (`Ox3IY`)

- `mobile_nav` (ID `EzQw9`)
- `page_header` (ID `TwwIV`, `padding [32px, 24px]`): breadcrumb, heading 22px, CodeBlock full-width, arch_filter
- `script_list` (ID `6Gn4c`, `padding: 24px`)
- `mobile_footer` (ID `ERNcL`)

---

### Script Detail `/scripts/[id]`

> **Pen nodes:** desktop `script_detail_desktop` (`rK8aO`) · mobile `script_detail_mobile` (`dWPZd`)

#### Desktop (1440px)

Sections top → bottom:

1. **NavBar** (`oZMJy`)
2. **detail_header** (ID `fZRvd`, `padding [48px, 120px]`, bottom border, vertical layout, gap 16px):
   - Breadcrumb: `home > {platform} > {script-id}`
   - Heading: `"> {script-id}"` (`--text-h1` 28px, bold)
   - Description: `"// short desc"` (IBM Plex Mono 16px, `--color-text-muted`)
   - badge_row (ID `259cz`, gap 8px): `[platform]` `[arch]` ArchBadges
3. **detail_body** (ID `jfP70`, `padding [48px, 120px]`, horizontal layout, gap 48px):
   - **main_col** (ID `AimCo`, `fill-container`, vertical layout, gap 16px):
     - `"// spec"` label (IBM Plex Mono 12px, `--color-text-muted`)
     - markdown_content (ID `hDtoM`, bordered box, vertical layout, gap 16px, padding 24px):
       - Renders `spec` field from script manifest
       - Headings: JetBrains Mono 16px bold
       - Prose: IBM Plex Mono 13px, `--color-text-muted`
       - Usage examples: CodeBlock component
   - **sidebar** (ID `7ByTR`, 280px wide, vertical layout, gap 20px):
     - metadata_card (ID `pi34T`, bordered, vertical layout, padding 20px): MetadataRows for platform / arch / shell / version
     - deps_card (ID `nLAse`, bordered, vertical layout, gap 12px, padding 20px): `"// dependencies"` label + DependencyTag row
4. **Footer** (`5Bddv`)

#### Mobile (390px) — stacked layout

> **Pen node:** `script_detail_mobile` (`dWPZd`)

- `mobile_nav` (ID `9s3KV`)
- `detail_header` (ID `HVxUt`, `padding [32px, 24px]`): breadcrumb, heading 22px, description 13px, badge_row
- `metadata_card` (ID `mOapH`, full-width, bottom border): MetadataRows stacked
- markdown_body: spec markdown content, `padding: 24px`
- deps_section: top border, `padding [20px, 24px]`: dependency tags
- `mobile_footer`

---

## 7. Interaction Patterns

### OS Detection (homepage only)

- Client-side, runs on mount
- Read `navigator.userAgent` or `navigator.platform`
- Windows → PowerShell install command (see FR-2-002)
- All other → Bash install command (see FR-2-002)
- CodeBlock language label reflects detected OS: `"// detected: windows"` or `"// detected: linux"`

### [copy] Button

- Click copies the CodeBlock's command text to clipboard
- Label briefly changes from `[copy]` to `[copied]` as visual feedback
- Reverts after a short delay (e.g. 2 seconds)

### Navigation

- **ScriptRow click**: navigate to `/scripts/[id]`
- **PlatformCard click**: navigate to `/scripts/{platform}`

### Arch / Distro / Version Filter Tabs

- Toggle active state client-side: `--color-accent` for selected, `--color-text-muted` for others
- Visual-only in the design (actual filtering is out-of-scope per FR; tabs reflect current URL query params or in-page state)

---

## 8. Responsive Strategy

| Breakpoint | Layout |
|---|---|
| ≥ 768px | Desktop layout (`padding [*, 120px]`, 3-col card grid, 2-col detail) |
| < 768px | Mobile layout (`padding [*, 24px]`, single column, stacked sections) |

- Desktop canvas: 1440px
- Mobile canvas: 390px
- No intermediate (tablet) screens were designed; use mobile layout below the 768px breakpoint

---

## 9. Content Conventions

| Pattern | Example |
|---|---|
| Comment labels | `// platforms`, `// arch:`, `// spec` |
| Heading prefix | `> scriptor`, `> windows scripts` |
| Shell prefix | `$ curl ...`, `$ irm ...` |
| Bracket tags | `[x86]`, `[copy]`, `[arm64]`, `[curl]` |
| Platform prompts | `C:\` Windows, `$` Linux, `%` macOS |
| Description prefix | `// installs docker engine and cli` |
| All text | lowercase |

---

## 10. Implementation Notes

- Load both font families from Google Fonts or bundle locally: **JetBrains Mono** and **IBM Plex Mono**
- Light mode is the only design. No dark mode.
- No custom icons — all visual indicators are text characters (`>`, `>>`, `$`, `//`, `C:\`, `%`)
- `[copy]` and filter tabs are interactive text, not icon buttons
- The `spec` field in script manifests contains markdown; render it with the typography rules defined in the markdown_content component above
- **Always validate against `ui/Variant1.pen`** using the Pencil MCP client before marking any component or page complete. The `.pen` file is the authoritative design reference.
