# cddtools (vendored)

Source: https://github.com/crazy0104/cddtools at
`8d735f02757fd251f06da8559f93a4adc3aa9ff0`.

The parser modules are copied verbatim. `cli.py`, `__main__.py` and
`cdd_viewer.py` are left out: EcuBus has its own entry point in
`../cddparse.py`, and the viewer needs tkinter, which the bundled Python
does not ship.

To re-sync, update and test cddtools first, then copy the package files and
LICENSE over this directory, keeping the three modules above out. Verify the
copied files match the source and update the provenance above.
