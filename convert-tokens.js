/**
 * Design Tokens to CSS Variables Converter
 * =========================================
 * Converts design tokens from design-tokens.tokens.json into production-ready CSS custom properties (variables).
 * 
 * Color System Architecture:
 * --------------------------
 * 1. Primitive Colors (--primitive-*):
 *    Foundational color palettes and key colors.
 *    IMPORTANT: Primitive colors are system foundations and MUST NOT be applied directly in UI styles.
 * 
 * 2. Color Roles (--color-role-* and --color-* aliases):
 *    Semantic design tokens (e.g. primary, surface, background, error).
 *    These link to Primitive Colors using CSS var(--primitive-...) references and ARE intended for direct UI component styling.
 * 
 * Features:
 * ---------
 * - Parses and normalizes color formats (8-digit hex #RRGGBBAA -> 6-digit hex #RRGGBB or rgba()).
 * - Resolves token references ({primitive colors...} -> var(--primitive-...)).
 * - Converts custom shadow effects into CSS box-shadow properties.
 * - Converts spacing tokens into CSS dimensions (px or rem).
 * - Converts typography token sets into CSS variables and clean utility classes.
 * - Generates clean, well-commented CSS output categorized into logical sections.
 */

import fs from 'fs';
import path from 'path';

/**
 * Convert string (camelCase, space-separated, etc.) to kebab-case slug
 * @param {string} str 
 * @returns {string}
 */
function toKebabCase(str) {
  return str
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Format color value (handles 8-digit hex, 6-digit hex, etc.)
 * @param {string} val 
 * @returns {string}
 */
function formatColor(val) {
  if (typeof val !== 'string') return val;
  val = val.trim();

  // Handle 8-digit hex #RRGGBBAA
  if (/^#([0-9a-fA-F]{8})$/.test(val)) {
    const hex = val.substring(1);
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const a = parseInt(hex.substring(6, 8), 16);

    if (a === 255) {
      return `#${hex.substring(0, 6).toLowerCase()}`;
    } else {
      const alpha = Number((a / 255).toFixed(2));
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  // Handle 6-digit hex #RRGGBB
  if (/^#([0-9a-fA-F]{6})$/.test(val)) {
    return val.toLowerCase();
  }

  return val;
}

/**
 * Format dimension value
 * @param {number|string} val 
 * @param {'px'|'rem'} unit 
 * @param {number} remBase 
 * @returns {string}
 */
function formatDimension(val, unit = 'px', remBase = 16) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return val;
  if (num === 0) return '0';
  if (unit === 'rem') {
    return `${Number((num / remBase).toFixed(4))}rem`;
  }
  return `${num}px`;
}

/**
 * Format custom-shadow effect object into CSS box-shadow string
 * @param {object} shadowObj 
 * @returns {string}
 */
function formatShadow(shadowObj) {
  if (!shadowObj || typeof shadowObj !== 'object') return 'none';
  const { offsetX = 0, offsetY = 0, radius = 0, spread = 0, color = '#000000' } = shadowObj;
  const formattedColor = formatColor(color);
  return `${offsetX}px ${offsetY}px ${radius}px ${spread}px ${formattedColor}`;
}

/**
 * Map typography token property names to standard CSS property names
 */
const TYPOGRAPHY_PROP_MAP = {
  fontSize: 'font-size',
  fontFamily: 'font-family',
  fontWeight: 'font-weight',
  fontStyle: 'font-style',
  fontStretch: 'font-stretch',
  lineHeight: 'line-height',
  letterSpacing: 'letter-spacing',
  textDecoration: 'text-decoration',
  textCase: 'text-transform',
  paragraphIndent: 'text-indent',
  paragraphSpacing: 'margin-bottom'
};

/**
 * Main Token Converter Class
 */
class TokenConverter {
  constructor(rawJson, options = {}) {
    this.rawJson = rawJson;
    this.options = {
      resolveRefs: options.resolveRefs || false,
      unit: options.unit || 'px',
      remBase: options.remBase || 16,
      includeUtilities: options.includeUtilities !== false
    };

    this.tokenMap = new Map(); // pathKey -> token info
    this.varNameMap = new Map(); // pathKey -> css var name
    this.flatTokens = [];
  }

  /**
   * Build path key string from array of path segments
   */
  buildPathKey(pathSegments) {
    return pathSegments.join('.');
  }

  /**
   * Determine CSS variable name for a token path
   */
  computeVarName(pathSegments) {
    const root = pathSegments[0];
    const restSegments = pathSegments.slice(1);
    const restSlug = restSegments.map(toKebabCase).join('-');

    switch (root) {
      case 'primitive colors':
        return `--primitive-${restSlug}`;
      case 'color roles':
        return `--color-role-${restSlug}`;
      case 'spacing collection':
        return `--spacing-${restSlug}`;
      case 'typography':
        return `--typography-${restSlug}`;
      case 'effect':
        return `--effect-${restSlug}`;
      case 'fontFamilies':
        return `--font-family-${restSlug}`;
      default:
        return `--${toKebabCase(root)}-${restSlug}`;
    }
  }

  /**
   * Traverse token tree and index all tokens
   */
  indexTokens(node, currentPath = []) {
    if (!node || typeof node !== 'object') return;

    // Check if node is a token leaf
    const isLeafToken = ('value' in node) || ('type' in node && typeof node.type === 'string' && node.type !== 'custom-shadow' && !('fontSize' in node));
    const isShadowLeaf = node.type === 'custom-shadow' && node.value;

    if (isShadowLeaf || (isLeafToken && !('fontSize' in node))) {
      const pathKey = this.buildPathKey(currentPath);
      const varName = this.computeVarName(currentPath);

      const tokenInfo = {
        path: currentPath,
        pathKey,
        varName,
        type: node.type,
        value: node.value,
        description: node.description || null,
        rawNode: node
      };

      this.tokenMap.set(pathKey, tokenInfo);
      this.varNameMap.set(pathKey, varName);
      this.flatTokens.push(tokenInfo);
      return;
    }

    // Traverse children
    for (const key of Object.keys(node)) {
      if (key === 'extensions') continue; // skip figma extensions metadata
      this.indexTokens(node[key], [...currentPath, key]);
    }
  }

  /**
   * Resolve token value or token reference
   */
  resolveTokenValue(token) {
    const rawVal = token.value;

    // Check if value is a reference like "{primitive colors.key colors group.primary key color}"
    if (typeof rawVal === 'string' && rawVal.startsWith('{') && rawVal.endsWith('}')) {
      const refPathKey = rawVal.substring(1, rawVal.length - 1).trim();

      if (this.tokenMap.has(refPathKey)) {
        const targetToken = this.tokenMap.get(refPathKey);

        if (!this.options.resolveRefs) {
          // Link via CSS var()
          return `var(${targetToken.varName})`;
        } else {
          // Recursively resolve raw value
          return this.resolveTokenValue(targetToken);
        }
      } else {
        console.warn(`[Warning] Referenced token not found: "${refPathKey}"`);
        return rawVal;
      }
    }

    // Format based on token type or path category
    const category = token.path[0];

    if (category === 'primitive colors' || category === 'color roles' || token.type === 'color') {
      return formatColor(rawVal);
    }

    if (category === 'spacing collection' || token.type === 'dimension') {
      return formatDimension(rawVal, this.options.unit, this.options.remBase);
    }

    if (token.type === 'custom-shadow') {
      return formatShadow(rawVal);
    }

    if (token.type === 'number') {
      return String(rawVal);
    }

    if (token.type === 'string') {
      const cleanVal = String(rawVal).trim();
      if (cleanVal === 'none' || cleanVal === 'normal') {
        return cleanVal;
      }
      // Font family formatting
      if (token.path[0] === 'fontFamilies' || token.path[token.path.length - 1] === 'fontFamily') {
        if (token.path[1] === 'neueHaasGrotesk') {
          return `"${cleanVal}", Helvetica Neue, Helvetica, Arial, sans-serif`;
        }
        return `"${cleanVal}", sans-serif`;
      }
      return `"${cleanVal}"`;
    }

    return String(rawVal);
  }

  /**
   * Process all indexed tokens and group them into CSS sections
   */
  generateCssSections() {
    const sections = {
      primitiveColors: [],
      colorRoles: [],
      spacing: [],
      typography: [],
      effects: [],
      fontFamilies: [],
      others: []
    };

    for (const token of this.flatTokens) {
      const category = token.path[0];
      const resolvedValue = this.resolveTokenValue(token);
      const comment = token.description ? ` /* ${token.description} */` : '';
      const declaration = `  ${token.varName}: ${resolvedValue};${comment}`;

      if (category === 'primitive colors') {
        sections.primitiveColors.push({ token, declaration, resolvedValue });
      } else if (category === 'color roles') {
        sections.colorRoles.push({ token, declaration, resolvedValue });
      } else if (category === 'spacing collection') {
        sections.spacing.push({ token, declaration, resolvedValue });
      } else if (category === 'typography') {
        sections.typography.push({ token, declaration, resolvedValue });
      } else if (category === 'effect') {
        sections.effects.push({ token, declaration, resolvedValue });
      } else if (category === 'fontFamilies') {
        sections.fontFamilies.push({ token, declaration, resolvedValue });
      } else {
        sections.others.push({ token, declaration, resolvedValue });
      }
    }

    return sections;
  }

  /**
   * Generate CSS utility classes for typography, elevation, etc.
   */
  generateUtilityClasses(sections) {
    const utils = [];

    utils.push(`/* ==========================================================================
   UTILITY CLASSES (Typography & Elevation)
   ========================================================================== */`);

    // Group typography tokens by typography variant (e.g., "display large")
    const typoVariants = new Map();
    for (const item of sections.typography) {
      const variantName = item.token.path[1]; // e.g. "display large"
      if (!typoVariants.has(variantName)) {
        typoVariants.set(variantName, []);
      }
      typoVariants.get(variantName).push(item);
    }

    const relevantTypoProps = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontStyle', 'textDecoration'];

    for (const [variantName, items] of typoVariants.entries()) {
      const className = `.typography-${toKebabCase(variantName)}`;
      utils.push(`${className} {`);
      
      for (const propKey of relevantTypoProps) {
        const item = items.find(i => i.token.path[2] === propKey);
        if (item) {
          const cssProp = TYPOGRAPHY_PROP_MAP[propKey] || toKebabCase(propKey);
          utils.push(`  ${cssProp}: var(${item.token.varName});`);
        }
      }
      utils.push(`}\n`);
    }

    // Shadow / Elevation utility classes
    for (const item of sections.effects) {
      const effectName = item.token.path[1];
      const className = `.shadow-${toKebabCase(effectName)}`;
      utils.push(`${className} {\n  box-shadow: var(${item.token.varName});\n}\n`);
    }

    return utils.join('\n');
  }

  /**
   * Generate complete output CSS string
   */
  convert() {
    this.indexTokens(this.rawJson);
    const sections = this.generateCssSections();

    const outputLines = [];

    // File Header Documentation
    outputLines.push(`/**
 * ============================================================================
 * DESIGN SYSTEM CSS CUSTOM PROPERTIES (VARIABLES)
 * Auto-generated from design-tokens.tokens.json
 * Generated At: ${new Date().toISOString()}
 * ============================================================================
 * 
 * COLOR ARCHITECTURE NOTICE & APPLICATION RULES:
 * 
 * 1. PRIMITIVE COLORS (--primitive-*)
 *    - Status: SYSTEM FOUNDATIONS ONLY.
 *    - DO NOT USE DIRECTLY IN UI COMPONENT STYLES.
 *    - Purpose: Raw color scales and palette definitions.
 * 
 * 2. COLOR ROLES (--color-role-* / --color-*)
 *    - Status: SEMANTIC UI APPLICATION TOKENS.
 *    - USE THESE FOR ALL UI SURFACES, COMPONENTS, TEXT, AND BORDERS.
 *    - Purpose: Theme-aware semantic color variables pointing to primitives.
 * ============================================================================
 */

:root {`);

    // 1. Primitive Colors Section
    outputLines.push(`\n  /* --------------------------------------------------------------------------
   * SECTION 1: PRIMITIVE COLOR FOUNDATIONS
   * (INTERNAL FOUNDATIONS - DO NOT APPLY DIRECTLY TO UI COMPONENTS)
   * -------------------------------------------------------------------------- */`);
    sections.primitiveColors.forEach(item => outputLines.push(item.declaration));

    // 2. Color Roles Section
    outputLines.push(`\n  /* --------------------------------------------------------------------------
   * SECTION 2: SEMANTIC COLOR ROLES
   * (APPLY THESE TO UI COMPONENTS & SURFACES)
   * -------------------------------------------------------------------------- */`);
    sections.colorRoles.forEach(item => outputLines.push(item.declaration));

    // Shorthand aliases for color roles (--color-<role-name>)
    outputLines.push(`\n  /* Shorthand Semantic Aliases */`);
    sections.colorRoles.forEach(item => {
      const roleSlug = toKebabCase(item.token.path.slice(1).join('-'));
      const aliasName = `--color-${roleSlug}`;
      outputLines.push(`  ${aliasName}: var(${item.token.varName});`);
    });

    // 3. Spacing Section
    outputLines.push(`\n  /* --------------------------------------------------------------------------
   * SECTION 3: SPACING TOKENS
   * -------------------------------------------------------------------------- */`);
    sections.spacing.forEach(item => outputLines.push(item.declaration));

    // 4. Typography Section
    outputLines.push(`\n  /* --------------------------------------------------------------------------
   * SECTION 4: TYPOGRAPHY TOKENS
   * -------------------------------------------------------------------------- */`);
    sections.typography.forEach(item => outputLines.push(item.declaration));

    // 5. Effects Section
    outputLines.push(`\n  /* --------------------------------------------------------------------------
   * SECTION 5: EFFECT & SHADOW TOKENS
   * -------------------------------------------------------------------------- */`);
    sections.effects.forEach(item => outputLines.push(item.declaration));

    // 6. Font Families Section
    outputLines.push(`\n  /* --------------------------------------------------------------------------
   * SECTION 6: FONT FAMILIES
   * -------------------------------------------------------------------------- */`);
    sections.fontFamilies.forEach(item => outputLines.push(item.declaration));

    // 7. Others Section
    if (sections.others.length > 0) {
      outputLines.push(`\n  /* --------------------------------------------------------------------------
   * SECTION 7: ADDITIONAL DESIGN TOKENS
   * -------------------------------------------------------------------------- */`);
      sections.others.forEach(item => outputLines.push(item.declaration));
    }

    outputLines.push(`}\n`);

    // Add Utility Classes if enabled
    if (this.options.includeUtilities) {
      outputLines.push(this.generateUtilityClasses(sections));
    }

    return outputLines.join('\n');
  }
}

// Execution Entry Point
function main() {
  const options = (function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
      input: path.join(__dirname, 'design-tokens.tokens.json'),
      output: path.join(__dirname, 'tokens.css'),
      resolveRefs: false,
      unit: 'px',
      includeUtilities: true
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--input' || arg === '-i') opts.input = path.resolve(args[++i]);
      else if (arg === '--output' || arg === '-o') opts.output = path.resolve(args[++i]);
      else if (arg === '--resolve-refs') opts.resolveRefs = true;
      else if (arg === '--unit') opts.unit = args[++i];
      else if (arg === '--no-utilities') opts.includeUtilities = false;
      else if (arg === '--help' || arg === '-h') {
        console.log(`
Design Tokens to CSS Converter
Usage: node convert-tokens.js [options]

Options:
  --input, -i <path>       Input JSON tokens file path
  --output, -o <path>      Output CSS file path
  --resolve-refs           Resolve token references to raw values instead of var()
  --unit <px|rem>          Dimension unit (default: px)
  --no-utilities           Skip utility classes generation
  --help, -h               Show help
        `);
        process.exit(0);
      }
    }
    return opts;
  })();

  console.log(`🚀 Reading design tokens from: ${options.input}`);
  
  if (!fs.existsSync(options.input)) {
    console.error(`❌ Error: Input file not found at ${options.input}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(options.input, 'utf-8');
  let jsonContent;
  try {
    jsonContent = JSON.parse(rawContent);
  } catch (err) {
    console.error(`❌ Error parsing JSON file: ${err.message}`);
    process.exit(1);
  }

  const converter = new TokenConverter(jsonContent, options);
  const cssResult = converter.convert();

  fs.writeFileSync(options.output, cssResult, 'utf-8');
  console.log(`✅ Successfully generated CSS variables file at: ${options.output}`);
  console.log(`📊 Processed ${converter.flatTokens.length} design tokens across ${converter.tokenMap.size} unique keys.`);
}

if (require.main === module) {
  main();
}

module.exports = { TokenConverter, toKebabCase, formatColor, formatDimension, formatShadow };
