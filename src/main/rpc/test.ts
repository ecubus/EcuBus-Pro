import express from 'express'
import { JSONRPCServer } from 'json-rpc-2.0'
import bodyParser from 'body-parser'

const server = new JSONRPCServer()
const app = express()
const port = 14901

// 使用中间件来解析 JSON 请求体
app.use(bodyParser.json())

app.post('/jsonrpc', (req, res) => {
  const jsonRPCRequest = req.body
  console.log('jsonRPCRequest', jsonRPCRequest)
  // server.receive takes a JSON-RPC request and returns a promise of a JSON-RPC response.
  // It can also receive an array of requests, in which case it may return an array of responses.
  // Alternatively, you can use server.receiveJSON, which takes JSON string as is (in this case req.body).
  server.receive(jsonRPCRequest).then((jsonRPCResponse) => {
    if (jsonRPCResponse) {
      res.json(jsonRPCResponse)
    } else {
      // If response is absent, it was a JSON-RPC notification method.
      // Respond with no content status (204).
      res.sendStatus(204)
    }
  })
})

app.listen(port, () => {
  console.log(`Express 服务器运行在 http://localhost:${port}`)
})
