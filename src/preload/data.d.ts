import type { CanInterAction, CanNode } from 'src/main/share/can';
import type { UdsDevice } from 'src/main/share/uds';
import type { TesterInfo } from 'src/main/share/tester';
import type { EthNode } from 'src/main/share/doip';
import type {LDF} from 'src/renderer/src/database/ldfParse'
import type {LinNode} from 'src/main/share/lin'
import type {YAXisOption} from 'echarts/types/dist/shared'





export interface CanInter {
    type: 'can',
    id: string,
    name: string,
    devices: string[],
    action: CanInterAction[]
}

export interface LinInter {
    id: string,
    name: string,
    devices: string[],
    type: 'lin',
    action: any[],
}
export type Inter = CanInter | LinInter
export type NodeItem = CanNode | EthNode | LinNode
export type GraphNode = {
    enable: boolean,
    id: string,
    name: string,
    color: string,
    graph?:{
        id:string,
        name:string,
    },
    disZoom?:boolean,
    yAxis?:YAXisOption
}
export interface DataSet {
    devices: Record<string, UdsDevice>
    tester: Record<string, TesterInfo>
    subFunction: Record<string, { name: string; subFunction: string }[]>
    nodes: Record<string, NodeItem>
    ia: Record<string, Inter>
    database:{
        lin:Record<string,LDF>
    },
    graphs: Record<string, GraphNode>
}