# cddtools (vendored)

Source: https://github.com/crazy0104/cddtools, based on
`b803f41dda93b459b1cc08d74544f7baf2ae51e7` plus the local read-only snapshot,
variant filtering, DTC properties and record-number fixes. These changes were
implemented and tested in the cddtools source repository before being copied
here; their source commit is pending.

The parser modules are copied verbatim. `cli.py`, `__main__.py` and
`cdd_viewer.py` are left out: EcuBus has its own entry point in
`../cddparse.py`, and the viewer needs tkinter, which the bundled Python
does not ship.

To re-sync, update and test cddtools first, then copy the package files and
LICENSE over this directory, keeping the three modules above out. Verify the
copied files match the source and update the provenance above.
