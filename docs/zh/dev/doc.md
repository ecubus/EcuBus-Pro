# Developer Documentation Guide

## Overview

This project uses [VitePress](https://vitepress.dev/) as the documentation system, supporting bilingual documentation in Chinese and English. Documentation is located in the `docs/` directory and written in Markdown format.

## Project Structure

```text
docs/
├── en/          # English documentation
│   ├── about/   # About pages
│   ├── dev/     # Developer documentation
│   ├── faq/     # FAQ
│   └── um/      # User manual
├── zh/          # Chinese documentation
│   ├── about/   # About pages
│   ├── dev/     # Developer documentation
│   └── um/      # User manual
├── media/       # Media files (images, videos, etc.)
│   ├── about/   # About page media files
│   └── um/      # User manual media files
└── component/   # Custom components
```

## Development Commands

### Local Development

```bash
# Start documentation development server
npm run docs:dev

# Build documentation
npm run docs:build

# Preview built documentation
npm run docs:preview
```

### Documentation Build

```bash
# Build production documentation
npm run docs:build
```

## Writing Documentation

### Multi-language Support

#### File Correspondence

Chinese and English documentation should maintain the same structure:

```text
docs/zh/dev/adapter.md  ↔  docs/en/dev/adapter.md
docs/zh/um/can/can.md   ↔  docs/en/um/can/can.md
```

#### Translation Guidelines

1. Create the Chinese version first
2. Translate to English version (can be done by AI)
3. Keep file structure consistent
4. Ensure links and image paths are correct

### Documentation Organization

#### Recommended Directory Structure

```text
docs/zh/
├── about/           # About pages
│   ├── contact.md   # Contact information
│   ├── install.md   # Installation guide
│   └── sponsor.md   # Sponsorship information
├── dev/             # Developer documentation
│   ├── adapter.md   # Adapter documentation
│   ├── addon.md     # Plugin development
│   └── arch.md      # Architecture documentation
├── faq/             # FAQ
│   └── index.md     # FAQ homepage
└── um/              # User manual
    ├── can/         # CAN bus
    ├── lin/         # LIN bus
    ├── uds/         # UDS service
    └── var/         # Variable management
```

#### File Naming Conventions

- Use lowercase letters and hyphens
- File names should be descriptive
- Avoid spaces and special characters

```text
✅ Correct: can-bus-guide.md
❌ Wrong: CAN Bus Guide.md
```
