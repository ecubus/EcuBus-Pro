"""Sphinx configuration for the EcuBus Pro Python package."""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

project = "EcuBus Pro Python"
author = "EcuBus Team"
year = datetime.now().year
copyright = f"{year}, {author}"

try:
    from importlib.metadata import version as get_version
    release = get_version("ecb")
except Exception:
    release = "0.1.0"

extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.autosummary",
    "sphinx.ext.napoleon",
    "sphinx.ext.viewcode",
    "myst_parser",
    "sphinx_autodoc_typehints",
]

autosummary_generate = True
autodoc_default_options = {"members": True, "undoc-members": False, "show-inheritance": True}
napoleon_google_docstring = True
napoleon_numpy_docstring = False
typehints_fully_qualified = True

templates_path = ["_templates"]
html_static_path = ["_static"]
html_theme = "furo"

source_suffix = {
    ".rst": "restructuredtext",
    ".md": "markdown",
}

exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

# Ensure build artifacts do not pollute version control.
os.makedirs(Path(__file__).parent / "_static", exist_ok=True)
os.makedirs(Path(__file__).parent / "_templates", exist_ok=True)
