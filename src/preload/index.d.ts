/*
 Copyright 2024 frankie.zengfu@gmail.com

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { ElectronAPI } from '@electron-toolkit/preload'
import type { Api } from './api'
import type { Ref } from 'vue'
import path from 'path'
import { Logger } from 'winston'
import type { Emitter } from 'mitt'
import { ServiceDetial } from 'nodeCan/uds'

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
    jQuery: any
    logBus: Emitter<any>
    dataParseWorker: Worker
    store: {
      set: (property: string, val: unknown) => void
      get: (key: string) => unknown
    }
    serviceDetail: ServiceDetial
    startTime: number
    path: typeof path
    MonacoEnvironment: any
    readmePath: string
    params: Record<string, string>
    $wujie: {
      bus: (typeof import('wujie'))['bus']
      shadowRoot?: ShadowRoot
      props?: { [key: string]: any }
      location?: Object
    }
  }
}
