"""
Setup script for ECB Python package
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read README
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text(encoding="utf-8") if readme_file.exists() else ""

setup(
    name="ecb",
    version="0.1.1",
    description="EcuBus-Pro Python Library - Python library for interacting with EcuBus-Pro",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="EcuBus Team",
    author_email="frankie.zengfu@gmail.com",
    url="https://github.com/ecubus/EcuBus",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "pyee>=11.0.0",
    ],
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: Apache Software License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering",
    ],
    keywords="ecubus can lin uds automotive testing",
    project_urls={
        "Documentation": "https://app.whyengineer.com",
        "Source": "https://github.com/ecubus/EcuBus",
        "Tracker": "https://github.com/ecubus/EcuBus/issues",
    },
)
