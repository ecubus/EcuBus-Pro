import type { GlobOptionsWithFileTypesFalse } from 'glob'
import type { Dirent, Stats } from 'fs'

export type Api = {
  glob: (pattern: string | string[], options?: GlobOptionsWithFileTypesFalse) => Promise<string[]>

  readdir: (path: string) => Promise<Dirent[]>
  state: (path: string) => Promise<Stats>
  getPort: (id: string) => void
}
