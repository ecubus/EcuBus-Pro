import express, { Request, Response, Express } from 'express'

// Handler types
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options'

export interface RequestHandler {
  (req: Request, res: Response): Promise<void> | void
}

export interface RouteHandler {
  method: HttpMethod
  path: string
  handler: RequestHandler
}

class RpcServer {
  static app: Express = express()
  private static server: any
  private static isRunning: boolean = false
  private static routes: RouteHandler[] = []

  private constructor() {}

  static start(port: number = 14901): Promise<void> {
    return new Promise((resolve, reject) => {
      if (RpcServer.isRunning) {
        resolve()
        return
      }
      RpcServer.app.use(express.json({ limit: '10mb' }))
      RpcServer.app.use(express.text({ type: '*/*', limit: '10mb' }))
      // 注册所有已存在的路由
      for (const route of RpcServer.routes) {
        ;(RpcServer.app as any)[route.method](route.path, route.handler)
      }
      // 404 fallback
      RpcServer.app.use((req, res) => {
        res.status(404).json({ error: 'Route not found' })
      })
      RpcServer.server = RpcServer.app.listen(port, 'localhost', () => {
        RpcServer.isRunning = true
        console.log(`SomeIP JSON-RPC server (express) started on localhost:${port}`)
        resolve()
      })
      RpcServer.server.on('error', (error: Error) => {
        console.error('SomeIP RPC server error:', error)
        reject(error)
      })
    })
  }

  static stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!RpcServer.isRunning) {
        resolve()
        return
      }
      RpcServer.server.close(() => {
        RpcServer.isRunning = false
        console.log('SomeIP JSON-RPC server stopped')
        resolve()
      })
    })
  }
}

export { RpcServer }
export default RpcServer
