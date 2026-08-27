# cddtools (vendored)

Source: https://github.com/crazy0104/cddtools at `25241bf`.

The parser modules are copied verbatim. `cli.py`, `__main__.py` and
`cdd_viewer.py` are left out: EcuBus has its own entry point in
`../cddparse.py`, and the viewer needs tkinter, which the bundled Python
does not ship.

To re-sync, copy the package files over this directory, keeping the three
modules above out, and update the commit above.
