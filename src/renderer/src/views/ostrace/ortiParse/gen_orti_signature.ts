import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { generateCstDts } from '@chevrotain/cst-dts-gen'
import { ORTIParser } from './parser'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const productions = new ORTIParser().getGAstProductions()
const dtsString = generateCstDts(productions)
const dtsPath = resolve(__dirname, 'orti_cst.d.ts')
writeFileSync(dtsPath, dtsString)
