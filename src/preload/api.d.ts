import type { GlobOptionsWithFileTypesFalse } from 'glob'
import type { Dirent, Stats } from 'fs'

export type Api = {
  glob: (pattern: string | string[], options?: GlobOptionsWithFileTypesFalse) => Promise<string[]>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, data: string) => Promise<void>
  readdir: (path: string) => Promise<Dirent[]>
  state: (path: string) => Promise<Stats>
}
