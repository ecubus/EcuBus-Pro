import * as PIXI from 'pixi.js-legacy'

const DEFAULT_FONT_SIZE = 8
const DEFAULT_FONT_NAME = 'LabelFont8White'
const DEFAULT_FONT_STYLE = {
  fontFamily: 'monospace',
  fontSize: 8,
  fill: 'white',
  fontWeight: 'bold'
}

export class FontController {
  private fontFamily: string
  private fontStyleMap: Map<number, Map<string, PIXI.TextStyle>>
  private fontNameMap: Map<number, Map<string, string>>
  private fontColorMap: Map<number, string>

  constructor(fontFamily: string = 'monospace') {
    this.fontFamily = fontFamily
    this.fontStyleMap = new Map<number, Map<string, PIXI.TextStyle>>()
    this.fontNameMap = new Map<number, Map<string, string>>()
    this.fontColorMap = new Map<number, string>()

    this.updateFontNameMapAndFontStyleMap(DEFAULT_FONT_SIZE)
  }

  getDefaultFont(): { fontName: string; fontStyle: PIXI.TextStyle } {
    return {
      fontName: DEFAULT_FONT_NAME,
      fontStyle: new PIXI.TextStyle(DEFAULT_FONT_STYLE)
    }
  }

  createFont(fontColor: string, fontSize: number): { fontName: string; fontStyle: PIXI.TextStyle } {
    const fontName = 'LabelFont' + fontSize.toString() + fontColor
    const fontStyle = {
      fontFamily: this.fontFamily,
      fontSize: fontSize,
      fill: fontColor === 'White' ? 'white' : 'black',
      fontWeight: 'bold'
    }
    PIXI.BitmapFont.from(fontName, fontStyle, { chars: this.getCharacterSet() })

    return {
      fontName: fontName,
      fontStyle: new PIXI.TextStyle(fontStyle)
    }
  }

  updateFontNameMapAndFontStyleMap(size: number) {
    let color2FontMap = new Map<string, string>()
    let style2FontMap = new Map<string, PIXI.TextStyle>()

    const blackFont = this.createFont('Black', size)
    color2FontMap.set('black', blackFont.fontName)
    style2FontMap.set('black', blackFont.fontStyle)

    const whiteFont = this.createFont('White', size)
    color2FontMap.set('white', whiteFont.fontName)
    style2FontMap.set('white', blackFont.fontStyle)

    this.fontNameMap.set(size, color2FontMap)
    this.fontStyleMap.set(size, style2FontMap)
  }

  getFont(
    color: number,
    size: number
  ): { fontName: string; fontStyle: PIXI.TextStyle | undefined } {
    let fontColor = this.fontColorMap.get(color)
    if (!fontColor) {
      let colorInHex = color.toString(16)
      const numZeros = 6 - colorInHex.length
      for (let i = 0; i < numZeros; ++i) {
        colorInHex = '0' + colorInHex
      }
      const result = /([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colorInHex)
      const r = parseInt(result ? result[1] : 'ff', 16) / 255
      const g = parseInt(result ? result[2] : 'ff', 16) / 255
      const b = parseInt(result ? result[3] : 'ff', 16) / 255

      if (
        0.2126 * Math.pow(r, 2.2) + 0.7152 * Math.pow(g, 2.2) + 0.0722 * Math.pow(b, 2.2) <=
        Math.pow(0.5, 2.2)
      ) {
        fontColor = 'white'
      } else {
        fontColor = 'black'
      }
      this.fontColorMap.set(color, fontColor)
    }

    let fontName: string | undefined
    let fontStyle: PIXI.TextStyle | undefined
    if (size) {
      const MIN_FONT_SIZE = 6
      size = Math.max(size, MIN_FONT_SIZE)
      if (!this.fontNameMap.has(size)) {
        this.updateFontNameMapAndFontStyleMap(size)
      }
      const size2FontMap = this.fontNameMap.get(size)
      fontName = size2FontMap ? size2FontMap.get(fontColor) : undefined

      const size2StyleMap = this.fontStyleMap.get(size)
      fontStyle = size2StyleMap ? size2StyleMap.get(fontColor) : undefined
    }
    return {
      fontName: fontName ? fontName : '',
      fontStyle: fontStyle
    }
  }

  private getCharacterSet(): string[][] {
    let letters: string[][] = []
    letters.push(PIXI.BitmapFont.ASCII[0])
    letters.push(['★', '★'])
    letters.push(['…', '…'])

    return letters
  }
}
