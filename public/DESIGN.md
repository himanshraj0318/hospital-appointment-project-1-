---
name: Clinical Ops
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#1d4ed8'
  on-secondary: '#ffffff'
  secondary-container: '#4069f2'
  on-secondary-container: '#fffbff'
  tertiary: '#ae0010'
  on-tertiary: '#ffffff'
  tertiary-container: '#d52022'
  on-tertiary-container: '#ffecea'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dce1ff'
  secondary-fixed-dim: '#b7c4ff'
  on-secondary-fixed: '#001551'
  on-secondary-fixed-variant: '#0039b5'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#ffb4ab'
  on-tertiary-fixed: '#410002'
  on-tertiary-fixed-variant: '#93000b'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an uncompromising, mission-critical clinical atmosphere engineered for hospital environments, triage monitoring, and patient appointment tracking. The interface prioritizes rapid cognitive scanning, zero ambiguity, and operational composure under high-stress conditions.

The visual style blends **High-Precision Corporate Modern** with functional **Information Architecture**:
- Sterile, high-contrast visual clarity over ornamental flourishes.
- Structured tabular arrays, strict border divisions, and high-visibility status indicators.
- Pure white surfaces anchored by subtle slate backgrounds, projecting rigorous sanitation, institutional reliability, and surgical precision.
- Zero perceptual lag: instantaneous recognition of patient priority states through standardized semantic color coding.

## Colors

The palette establishes an immediate clinical hierarchy:

- **Canvas & Surfaces:**
  - Base Background: Slate canvas `#f8fafc`.
  - Surface Cards & Tiers: Crisp pure white `#ffffff`.
  - Structural Dividing Lines: Subtle clinical slate `#e2e8f0`.
- **Medical Trust Blue (Primary & Action):**
  - Primary Base: `#2563eb` for active filters, navigation indicators, primary buttons, and confirmed telemetry markers.
  - Primary Deep: `#1d4ed8` for focus states, hover interactions, and key metric labels.
- **Emergency Crimson (Critical & Triage):**
  - Alert High: `#dc2626` for critical triage tags, STAT laboratory flags, and emergency room queues.
  - Alert Dark: `#b91c1c` for destructive confirmations and vital signs distress values.
  - Alert Soft Fill: `#fef2f2` for urgent card backgrounds, highlighted patient rows, and urgent badge backplates.
- **Supportive Status Accents:**
  - Waiting / In-Observation Amber: Text `#b45309`, Border `#fde68a`, Surface `#fffbeb`.
  - Confirmed Routine Emerald: Text `#047857`, Border `#a7f3d0`, Surface `#ecfdf5`.
- **Neutrals & Typography:**
  - Foreground High-Contrast: Slate 900 `#0f172a` for primary data points and patient identities.
  - Foreground Muted: Slate 600 `#475569` for field labels, secondary metrics, and metadata.
  - Ghost Subtle: Slate 400 `#94a3b8` for inactive timestamps and placeholder text.

## Typography

Typography relies entirely on **Inter** to ensure maximum legibility at variable distances, low monitor resolutions, and under rapid peripheral scanning:

- **Tabular Figures:** All numeric readouts (vitals, bed identifiers, timestamps, MRN numbers) must enforce monospace/tabular numerical formatting (`font-feature-settings: "tnum"`).
- **Status Hierarchy:** Badges and operational chips utilize `label-sm` with explicit uppercase rendering and extended letter spacing for instantaneous comprehension.
- **Data Densification:** `body-md` serves as the primary reading standard across tables and forms, providing sufficient whitespace while maximizing visible patient records without requiring excessive scroll depth.

## Layout & Spacing

The layout operates on a **Fixed-Fluid Responsive Grid** optimized for high-density multi-monitor workstations and tablet diagnostic carts:

- **Desktop (1200px+):** 12-column grid, 2rem outer canvas margin, 1.5rem gutters. Facilitates split-screen operational panels, triage summary boards, and patient record detail panes simultaneously.
- **Tablet / Clinical Cart (768px - 1199px):** 8-column grid with 1rem gutters and 1.5rem margin. Side navigation collapses into an icon-dense rail; table views transition to scrollable dense data grids.
- **Mobile (Handheld Triage, <768px):** 4-column layout with 1rem margins. Cards reflow into vertical operational stacks with full-width action drawers.

Spacing follows an exact 4px-based rhythm where internal component padding remains disciplined to avoid unnecessary interface height.

## Elevation & Depth

Visual separation in this system relies on **Low-Contrast Outlines & Tonal Surface Stacking** rather than heavy blurred drop shadows:

- **Base Elevation (Flat Plane):** Dashboard canvas rendered in `#f8fafc`.
- **Card Tier 1 (Resting Panel):** Solid `#ffffff` encased in a crisp `1px solid #e2e8f0` border. No drop shadow is used during standard resting states to preserve an immaculate, clinical feel.
- **Active / Alert Tier (High Priority):** Emergency cards and active triage alerts utilize a dual-border treatment: a 1px border of `#fecaca` combined with a solid 3px left-side accent stripe in `#dc2626`.
- **Floating Modals & Flyouts:** Restrained clinical shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`, bounded by a `1px solid #cbd5e1` edge.

## Shapes

The design uses **Soft (Level 1)** rounding throughout:
- Standard elements (buttons, inputs, notification pills, alert frames) feature `0.25rem` (4px) corner radii, asserting professional structure and institutional authority.
- Larger containers, slide-out panels, and primary diagnostic cards utilize `rounded-lg` (`0.5rem` / 8px).
- Modals and key diagnostic overlays cap at `rounded-xl` (`0.75rem` / 12px).
- Fully circular radii (`9999px`) are strictly reserved for circular avatar badges and count indicators.

## Components

### Buttons
- **Primary:** Background `#2563eb`, text `#ffffff`, border 1px solid `#1d4ed8`. Hover: `#1d4ed8`. Focus: 2px offset ring with `#2563eb`.
- **Emergency / Destructive:** Background `#dc2626`, text `#ffffff`, border 1px solid `#b91c1c`. Hover: `#b91c1c`.
- **Secondary / Ghost:** Background `#ffffff`, text `#0f172a`, border 1px solid `#e2e8f0`. Hover: `#f8fafc`.

### Status Badges & Chips
- **Emergency (STAT):** Background `#fef2f2`, border 1px solid `#fecaca`, text `#dc2626`. Includes a persistent pulsing red dot (`#dc2626`) indicator.
- **Waiting (Observation):** Background `#fffbeb`, border 1px solid `#fde68a`, text `#b45309`.
- **Confirmed (Routine):** Background `#ecfdf5`, border 1px solid `#a7f3d0`, text `#047857`.

### Patient Triage Lists & Tables
- **Standard Row:** Alternating subtle zebra striping (`#ffffff` to `#fcfdfd`), separated by `1px solid #e2e8f0`.
- **Urgent Triage Row:** Background `#fef2f2`, border-left `4px solid #dc2626`, row division border `#fee2e2`.
- **Header Cells:** Background `#f8fafc`, typography `label-sm`, text `#475569`, tracking expanded, bottom border `2px solid #e2e8f0`.

### Form Inputs & Controls
- **Input Fields:** Pure white background, `1px solid #cbd5e1` border, `0.25rem` radius, placeholder `#94a3b8`. Focus state triggers `1px solid #2563eb` with a 2px blue ring (`rgba(37, 99, 235, 0.15)`).
- **Checkboxes & Radios:** Controlled size (16px), border `1px solid #cbd5e1`, active state `#2563eb`. Emergency checklists use `#dc2626` active states.

### Clinical Data Cards
- Container: Background `#ffffff`, border `1px solid #e2e8f0`, internal padding `1.25rem` (`space-lg`).
- Header: Divided by a light hairline border `1px solid #f1f5f9` with embedded status badges right-aligned.
- Critical Alert Card Variant: Background `#fffefe`, border `1px solid #fca5a5`, with a prominent top border bar of `3px solid #dc2626`.