## EcuBus Pro Python

Python bindings for EcuBus Pro. Install directly from the repo root:

```bash
pip install .
```

### Documentation

Documentation is built with Sphinx under `python/docs`. To build locally:

```bash
python -m pip install -r python/docs/requirements.txt
sphinx-build -b html python/docs python/docs/_build/html
```

API reference pages are generated from the `ecb` package with autodoc and autosummary.
