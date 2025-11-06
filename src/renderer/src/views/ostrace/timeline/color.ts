function colorStringToNumber(color: string): number {
  if (!color) return 0x000000
  const trimmed = color.trim()
  const rgb = trimmed.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i)
  if (rgb) {
    const r = parseInt(rgb[1], 10)
    const g = parseInt(rgb[2], 10)
    const b = parseInt(rgb[3], 10)
    return (r << 16) + (g << 8) + b
  }
  const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return parseInt(hex, 16)
  }
  // Fallback black if unparsable
  return 0x000000
}
function getCssVar(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}
export function getColorFromCssVar(cssVar: string, fallback: string): number {
  const value = getCssVar(cssVar) || fallback
  return colorStringToNumber(value)
}
