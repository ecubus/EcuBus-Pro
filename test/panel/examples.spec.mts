import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'
import { bindPanelFile, parsePanelFile } from '../../src/renderer/src/stores/panelFiles'

const legacy = JSON.parse(readFileSync('test/panel/fixtures/legacy-panels.json', 'utf8'))
function leaves(rules: any[]): any[] {
  return rules.flatMap((rule) => (rule.type === 'grid' ? leaves(rule.children) : [rule]))
}

for (const [name, original] of Object.entries(legacy) as [string, any][]) {
  it(`migrates ${name} without losing bindings or button behavior`, () => {
    const filename = `resources/examples/${name}.ecb`
    const project = JSON.parse(readFileSync(filename, 'utf8')).data
    project.database = { can: {}, lin: {}, orti: {}, ...project.database }
    project.database.can = Object.fromEntries(
      Object.entries(project.database.can).filter(
        ([, db]: [string, any]) => db.version === 'canmartix'
      )
    )
    for (const [id, oldPanel] of Object.entries(original.panels) as [string, any][]) {
      const reference = project.panels[id]
      expect(reference.document).toBeUndefined()
      expect(reference.rule).toEqual([])
      const panel = parsePanelFile(
        readFileSync(path.join(path.dirname(filename), reference.filePath), 'utf8')
      )
      const controls = panel.document.controls
      const rules = leaves(oldPanel.rule)
      expect(controls).toHaveLength(rules.length)
      const resolved = bindPanelFile(panel.document, project)
      controls.forEach((control, index) => {
        const old = rules[index]
        const node = old.props?.variable || old.props?.signal
        if (node) {
          const target = control.binding!.node.bindValue as any
          expect(target.variableFullName || target.signalName).toBe(
            node.bindValue.variableFullName || node.bindValue.signalName
          )
          const rebound = resolved.controls[index].binding!
          if (rebound.kind === 'variable') expect(rebound.node.bindValue.variableId).not.toBe('')
          else expect(rebound.node.bindValue.dbKey).not.toBe('')
        }
        if (old.type === 'BButton') {
          expect(control.pressValue).toBe(old.props.pressValue)
          expect(control.releaseValue).toBe(old.props.releaseValue)
          expect(control.toggle).toBe(!!old.props.toggleMode)
        }
        if (old.type === 'input') {
          expect(control.editorMode).toBe('text')
          expect(
            control.binding?.kind === 'variable' && control.binding.node.bindValue.variableValueType
          ).toBe('string')
        }
        expect(control.x + control.width).toBeLessThanOrEqual(panel.document.width)
        expect(control.y + control.height).toBeLessThanOrEqual(panel.document.height)
      })
    }
  })
}

it('ships the standalone HTML control with matching editable source and isolated simulate channels', () => {
  const directory = 'resources/examples/panel_html'
  const project = JSON.parse(readFileSync(`${directory}/HtmlControl.ecb`, 'utf8')).data
  const panel = parsePanelFile(readFileSync(`${directory}/html.ecpanel`, 'utf8'))
  const html = panel.document.controls.find((control) => control.id === 'html')!
  expect(html.htmlContent).toBe(readFileSync(`${directory}/control.html`, 'utf8'))
  expect(html.scriptContent).toBe(readFileSync(`${directory}/control.js`, 'utf8'))
  expect(project.nodes['html-ecu'].channel).toEqual(['html-ecu-can'])
  expect(project.ia['html-command'].action[0].channel).toBe('html-panel-can')
  expect(Object.values(project.devices).map((device: any) => device.canDevice.vendor)).toEqual([
    'simulate',
    'simulate'
  ])
})
