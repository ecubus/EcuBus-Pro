import axios, { AxiosRequestConfig } from 'axios'
import { ipcMain } from 'electron'

//fetch
ipcMain.handle('ipc-axios-get', async (event, url: string, options: AxiosRequestConfig) => {
  const response = await axios.get(url, options)
  return response.data
})
