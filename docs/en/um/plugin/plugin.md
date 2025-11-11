# Plugin

## Overview

The Plugin system is a powerful extensibility feature that allows you to enhance EcuBus-Pro with custom functionality. Plugins enable developers to create and share additional features, tools, and integrations that extend the core capabilities of the application. Through the Plugin Marketplace, you can discover, install, and manage plugins to customize your EcuBus-Pro experience according to your specific needs.

## Key Features

### Plugin Marketplace

The Plugin Marketplace provides a centralized location to discover and install plugins:
![marketplace](./image.png)
### Extension Points

Plugins can extend EcuBus-Pro in two main ways:

#### Custom Tabs

Plugins can create entirely new tabs in the application interface:

- Add specialized tools and interfaces
- Create custom workflows for specific use cases
- Implement domain-specific functionality
- Integrate external services or tools

#### Tab Extensions

Plugins can extend existing tabs with additional functionality:

- Add buttons and controls to existing tabs (Test, CAN, LIN, Hardware, etc.)
- Integrate new features seamlessly into the current workflow
- Enhance existing functionality without modifying core code
- Provide specialized tools for specific tabs
![tab-extensions](./image-1.png)

### Development Support

Developing plugins is very convenient. See the [Plugin Development Guide](../../dev/plugin.md) for details.
