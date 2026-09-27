import { readFileSync, writeFileSync } from 'node:fs'

const file = new URL('./html.ecpanel', import.meta.url)
const panel = JSON.parse(readFileSync(file, 'utf8'))
const control = panel.document.controls.find((item) => item.id === 'html')
control.htmlContent = readFileSync(new URL('./control.html', import.meta.url), 'utf8')
control.scriptContent = readFileSync(new URL('./control.js', import.meta.url), 'utf8')
writeFileSync(file, JSON.stringify(panel, null, 2) + '\n')
