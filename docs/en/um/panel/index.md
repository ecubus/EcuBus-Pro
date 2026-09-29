# Panel

## Free-layout Panel

Create a Panel from the Panel menu, drag controls onto the canvas, and configure bindings in the property editor. Use groups, tabs, alignment, resizing and undo/redo to arrange the interface. Editor preview checks layout; start measurement in the runtime view to interact with variables and signals.

Save the layout as an `.ecpanel` file. The `.ecb` project keeps its file reference, so share both files. Import an existing `.ecpanel` to reuse a layout; relink a missing file after moving it. Relinking uses the name stored in the selected file. Legacy embedded panels convert automatically when every item is supported; otherwise the editor shows a migration report and saves the converted controls as a new `.ecpanel` copy.

Open `resources/examples/panel_showcase/PanelShowcase.ecb` for a demonstration using two simulate CAN channels. Bind a Slider, Number and Progress control to the same user variable to see them update together. Signal writes update database values; start the corresponding periodic message to transmit them onto the bus.

### HTML control

Open `resources/examples/panel_html/HtmlControl.ecb` for a standalone HTML example. The HTML field accepts markup, styles and inline scripts; the Script field runs after that markup. Both can access the asynchronous `panel` API:

```js
const level = await panel.getVar('HtmlLevel')
await panel.setVar('HtmlLevel', level + 1)
await panel.setSignal('HtmlDemo.Target', '45')
const unsubscribe = await panel.onVar('HtmlLevel', value => console.log(value))
// Call unsubscribe() when the subscription is no longer needed.
```

Wrap asynchronous code in an async function when placing it in a script field. `setSignal` accepts a finite number (raw value) or a string (physical value or enum label). Writes require a running measurement. Signal writes reject on failure. The HTML frame cannot directly access Node.js, local files or network connections.

Panel **Open file** buttons support folders and PDF, TXT, Markdown, CSV, PNG, JPEG, GIF, BMP and WebP files. Executables, shortcuts, scripts and other file types are rejected before opening.

`getSignal()` returns the latest decoded transmitted or received frame sample in the current measurement, independently of HTML subscriptions. Without a sample it falls back to the project database value, which may be unset. `setSignal()` updates the transmit database; success does not confirm transmission or ECU processing. Reading immediately after writing therefore does not guarantee the newly written value. Signal recording starts with measurement so a first read or a newly opened window can retrieve earlier one-shot samples.

### Remember last value

User-defined variables have **Remember last value** enabled by default, including existing variables without an explicit setting. After a saved project has run, remembered values override initial values on the next measurement. Changing an initial value alone does not replace an existing remembered value.

To always use the initial value, open the user variable editor and turn off **Remember last value**. To clear stored values, stop measurement, open **Remembered values** in the variable page, select the project and delete its record. The next start uses initial values; enabled variables will be remembered again. Active or still-writing records cannot be deleted.

Values are stored locally per project path, separately from `.ecb` and `.ecpanel`. Unsaved projects, built-in system variables and CAN/LIN signal values are not persisted. Moving or renaming a project starts a separate memory record; obsolete records can be deleted in the same dialog.

Remembered-value files apply only to desktop GUI measurement. The CLI does not load them: it starts from the variable definitions in the project file (normally the initial values), without restoring values remembered by the GUI.

## Panel Capabilities

The Panel feature offers exceptional flexibility for quickly building various demonstrations or testing platforms:

- Create conversion tools with graphical interfaces for users
- Build testing pipelines with simple, click-based interfaces for production line workers
- Connect components to DBC/LDF file signals, enabling UI changes to trigger corresponding signal changes, see [Database](./../database)
- Bind components to user-defined or system variables to display or modify their values, see [Variable](./../var/var)
- And much more to be discovered!

## Panel Example

[Led Control Panel Example](../../../examples/panel/readme.md)
