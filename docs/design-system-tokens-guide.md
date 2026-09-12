# Design System Tokens & CSS Variables Documentation

This guide documents the design system architecture, the color system philosophy (Primitive Foundations vs. Semantic UI Color Roles), the Node.js token converter script (`convert-tokens.js`), and component implementation examples.

---

## 1. Color System Architecture Philosophy

Our design system enforces a strict **two-tier color architecture** inspired by modern design system standards (such as Material Design 3 and Radix Colors):

```
┌─────────────────────────────────────────────────────────┐
│              TIER 1: PRIMITIVE COLORS                   │
│          (System Foundations / Raw Palettes)            │
│   e.g., #2563eb, #ffffff, Primary Palette (0-100)       │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼ (linked via CSS var())
┌─────────────────────────────────────────────────────────┐
│               TIER 2: COLOR ROLES                       │
│      (Semantic UI Application Tokens / Surfaces)        │
│   e.g., --color-primary, --color-on-primary, --color-surface│
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼ (used directly)
┌─────────────────────────────────────────────────────────┐
│               UI COMPONENTS & LAYOUTS                   │
│     Buttons, Forms, Cards, Modals, Typography, Borders   │
└─────────────────────────────────────────────────────────┘
```

### 1.1 Primitive Colors (`--primitive-*`)
- **Role**: Foundations & Raw Scales.
- **Variable Prefix**: `--primitive-` (e.g., `--primitive-key-colors-group-primary-key-color`, `--primitive-primary-color-palette-primary40`).
- **Rule**: ⚠️ **NEVER apply Primitive Color variables directly in UI component styles.**
- **Reason**: Primitive colors are absolute color values (hex/rgba). If component styles reference primitives directly, changing themes (e.g. Dark Mode, High Contrast, Brand Rebrand) requires modifying every single CSS rule across the entire application.

### 1.2 Color Roles (`--color-role-*` & `--color-*`)
- **Role**: Semantic UI Intent Tokens.
- **Variable Prefixes**: `--color-role-` and shorthand `--color-` (e.g., `--color-primary`, `--color-on-primary`, `--color-surface-color`, `--color-error-color`).
- **Rule**: ✅ **ALWAYS use Color Roles for styling UI elements (backgrounds, text, borders, icons).**
- **Mechanism**: Color roles point to primitive color variables using `var(--primitive-...)`. When switching modes or rebranding, only the primitive mappings change while component code remains 100% untouched.

---

## 2. Token Conversion Script (`convert-tokens.js`)

The `convert-tokens.js` script parses `design-tokens.tokens.json` and outputs production-ready CSS Custom Properties into `tokens.css`.

### 2.1 Key Transformation Features
1. **8-digit Hex Normalization**: Automatically converts Figma 8-digit hex values (`#2563ebff`) into standard 6-digit hex (`#2563eb`) when alpha is `100%`, or `rgba(r, g, b, alpha)` when alpha is `< 1.0` (e.g., `#00000052` -> `rgba(0, 0, 0, 0.32)`).
2. **Reference Alias Resolution**: Converts `{primitive colors.key colors group.primary key color}` tokens into CSS `var(--primitive-key-colors-group-primary-key-color)`.
3. **Custom Shadow Generation**: Transforms composite `custom-shadow` tokens into valid CSS `box-shadow` property strings (`offsetX offsetY radius spread color`).
4. **Spacing Normalization**: Converts dimension values into CSS pixel values (`px`) or rem values (`rem`).
5. **Typography & Utilities**: Generates individual CSS custom properties for typography attributes alongside ready-to-use utility classes (`.typography-display-large`, `.shadow-hard-shadow`, etc.).

### 2.2 CLI Usage & Options

Run the converter from your terminal:

```bash
# Standard execution (generates tokens.css in px)
node convert-tokens.js

# Or using NPM scripts
npm run build:tokens

# Generate rem-based dimensions
npm run build:tokens:rem

# Generate resolved values (inlines raw colors instead of var() links)
npm run build:tokens:resolved
```

#### CLI Options Flags:
| Option Flag | Short | Description | Default |
| :--- | :--- | :--- | :--- |
| `--input <path>` | `-i` | Path to design tokens JSON file | `design-tokens.tokens.json` |
| `--output <path>` | `-o` | Output CSS file destination | `tokens.css` |
| `--resolve-refs` | | Resolve token references to raw values instead of `var()` | `false` |
| `--unit <px\|rem>` | | Dimension unit for spacing & fonts | `px` |
| `--no-utilities` | | Skip utility classes generation | `false` |

---

## 3. Design Tokens Reference Index

### 3.1 Color Roles (UI Application Tokens)

Use these variables across all HTML/CSS components:

| Color Role (Shorthand) | Full Variable Name | Target Primitive Link | Description / Purpose |
| :--- | :--- | :--- | :--- |
| `--color-primary` | `--color-role-primary` | `var(--primitive-key-colors-group-primary-key-color)` | Primary brand action color |
| `--color-on-primary` | `--color-role-on-primary` | `var(--primitive-primary-color-palette-primary100)` | Text/icon color on primary background |
| `--color-primary-container` | `--color-role-primary-container` | `var(--primitive-primary-color-palette-primary90)` | Subtle container background for primary actions |
| `--color-on-primary-container` | `--color-role-on-primary-container` | `var(--primitive-primary-color-palette-primary30)` | Text/icon color on primary container |
| `--color-secondary` | `--color-role-secondary` | `var(--primitive-secondary-color-palette-secondary40)` | Secondary brand color |
| `--color-on-secondary` | `--color-role-on-secondary` | `var(--primitive-secondary-color-palette-secondary100)` | Text/icon color on secondary background |
| `--color-tertiary` | `--color-role-tertiary` | `var(--primitive-tertiary-color-palette-tertiary40)` | Accent / Tertiary brand color |
| `--color-surface-color` | `--color-role-surface-color` | `var(--primitive-neutral-color-palette-neutral98)` | Main app surface background |
| `--color-on-surface-color` | `--color-role-on-surface-color` | `var(--primitive-neutral-color-palette-neutral10)` | Primary body text color on surface |
| `--color-outline-color` | `--color-role-outline-color` | `var(--primitive-n-varaint-color-palette-n-variant50)` | Form input borders and card dividers |
| `--color-error-color` | `--color-role-error-color` | `var(--primitive-error-color-palette-error40)` | Error messages, danger buttons, alert states |
| `--color-on-error-color` | `--color-role-on-error-color` | `var(--primitive-error-color-palette-error100)` | Text/icon color on error background |
| `--color-positive` | `--color-role-positive` | `var(--primitive-green-color-palette-green40)` | Success / affirmative states |
| `--color-on-positive` | `--color-role-on-positive` | `var(--primitive-green-color-palette-green100)` | Text/icon color on positive surface |
| `--color-background` | `--color-role-background` | `var(--primitive-neutral-color-palette-neutral98)` | Page viewport background |
| `--color-on-background` | `--color-role-on-background` | `var(--primitive-neutral-color-palette-neutral10)` | Base text color on page background |

### 3.2 Spacing Tokens

| CSS Variable | Value | Description |
| :--- | :--- | :--- |
| `--spacing-no-spacing` | `0` | Zero spacing |
| `--spacing-extra-small-spacing` | `4px` | Tiny gaps, icon paddings |
| `--spacing-compact-spacing` | `6px` | Compact button padding |
| `--spacing-small-spacing` | `8px` | Small inline element spacing |
| `--spacing-medium-spacing` | `12px` | Input padding, chip spacing |
| `--spacing-base-spacing` | `16px` | Standard component padding |
| `--spacing-large-spacing` | `20px` | Card section padding |
| `--spacing-extra-large-spacing` | `24px` | Modal body padding |
| `--spacing-very-large-spacing` | `32px` | Layout section gaps |

### 3.3 Effect & Elevation Tokens

| CSS Variable | CSS Utility Class | Computed Value | Description |
| :--- | :--- | :--- | :--- |
| `--effect-soft-shadow` | `.shadow-soft-shadow` | `2px 2px 20px 0px rgba(0,0,0,0.12)` | Subtle card elevation |
| `--effect-medium-shadow` | `.shadow-medium-shadow` | `2px 4px 6px 0px rgba(0,0,0,0.28)` | Dropdown menus, popovers |
| `--effect-hard-shadow` | `.shadow-hard-shadow` | `4px 6px 8px 0px rgba(0,0,0,0.32)` | Modals, prominent overlays |

---

## 4. UI Implementation Code Examples

### 4.1 Including Generated Tokens in HTML
Add `tokens.css` at the top of your document `<head>`:

```html
<link rel="stylesheet" href="./tokens.css">
```

### 4.2 Primary Button Component (CSS)

```css
.btn-primary {
  /* Use Color Roles for Background and Text */
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  
  /* Spacing Tokens */
  padding: var(--spacing-medium-spacing) var(--spacing-base-spacing);
  border-radius: var(--spacing-small-spacing);
  border: 1px solid transparent;
  
  /* Typography & Elevation */
  font-family: var(--typography-label-large-font-family);
  font-size: var(--typography-label-large-font-size);
  font-weight: var(--typography-label-large-font-weight);
  line-height: var(--typography-label-large-line-height);
  
  cursor: pointer;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.btn-primary:hover {
  background-color: var(--color-primary-container);
  color: var(--color-on-primary-container);
  box-shadow: var(--effect-soft-shadow);
}
```

### 4.3 Form Input Field (CSS)

```css
.form-input {
  background-color: var(--color-surface-color);
  color: var(--color-on-surface-color);
  border: 1px solid var(--color-outline-color);
  padding: var(--spacing-medium-spacing);
  border-radius: var(--spacing-small-spacing);
  
  font-family: var(--typography-body-medium-font-family);
  font-size: var(--typography-body-medium-font-size);
  width: 100%;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-container);
}

.form-input.is-invalid {
  border-color: var(--color-error-color);
}
```

### 4.4 HTML Component Example using Utility Classes

```html
<div class="card shadow-medium-shadow" style="background: var(--color-surface-color); padding: var(--spacing-large-spacing); border-radius: var(--spacing-small-spacing);">
  <h2 class="typography-headline-medium" style="color: var(--color-on-surface-color); margin-bottom: var(--spacing-small-spacing);">
    Authentication Required
  </h2>
  <p class="typography-body-medium" style="color: var(--color-on-surface-variant-c); margin-bottom: var(--spacing-base-spacing);">
    Please sign in to access your dashboard settings.
  </p>
  <button class="btn-primary">Continue</button>
</div>
```

---

## 5. Summary & Maintenance Rules

1. **Modify Source, Re-run Converter**: Whenever Figma design tokens are updated, replace `design-tokens.tokens.json` and execute `npm run build:tokens`.
2. **Never Edit `tokens.css` Manually**: Direct edits to `tokens.css` will be overwritten when tokens build script runs.
3. **Strict Code Reviews**: Ensure pull requests never introduce raw color hexes or `--primitive-*` variables in component CSS code.
