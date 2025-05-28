import fsP from 'fs/promises'
import fs from 'fs'
import path from 'path'
import { XMLParser } from 'fast-xml-parser'
import antlr4 from 'antlr4'
import parse from './g4/parse.js'

export async function parseXml(filePath: string) {
  if (fs.existsSync(filePath)) {
    //
    const contet = await fsP.readFile(filePath, 'utf-8')
    const parser = new XMLParser()
    return parser.parse(contet)
  } else {
    throw new Error(`${filePath} doesn't exits`)
  }
}

export async function parseIdl(filePath: string) {
  if (fs.existsSync(filePath)) {
    //
    const contet = await fsP.readFile(filePath, 'utf-8')
    return parse(contet)
  } else {
    throw new Error(`${filePath} doesn't exits`)
  }
}
