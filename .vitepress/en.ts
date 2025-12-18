import { createRequire } from 'module'
import { defineConfig, type DefaultTheme } from 'vitepress'
import enData from './en.json'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

export const en = defineConfig({
  lang: 'en-US',
  description: 'A powerful automotive ECU development tool',
  themeConfig: {
    nav: nav(),
    sidebar: sidebar(),
    editLink: {
      pattern: 'https://github.com/ecubus/EcuBus-Pro/edit/master/:path',
      text: 'Edit this page on GitHub'
    },
    docFooter: {
      prev: 'Previous',
      next: 'Next'
    },
    outline: {
      label: 'Page Navigation',
      level: [2, 4]
    },
    lastUpdated: {
      text: 'Last Updated',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium'
      }
    },
    langMenuLabel: 'Language',
    returnToTopLabel: 'Return to Top',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Theme',
    lightModeSwitchTitle: 'Switch to Light Mode',
    darkModeSwitchTitle: 'Switch to Dark Mode',
    skipToContentLabel: 'Skip to Content'
  }
})

function nav(): DefaultTheme.NavItem[] {
  return [
    {
      text: '📦 Plugin Marketplace',
      link: '/docs/plugin/index.md'
    },
    {
      text: 'FAQ',
      link: '/docs/faq/index.md'
    },
    {
      text: pkg.version,
      items: [
        {
          text: 'Changelog',
          link: 'https://github.com/ecubus/EcuBus-Pro/blob/master/docs/dev/releases_note.md'
        }
      ]
    },
    {
      text: 'Script API',
      link: 'https://app.whyengineer.com/scriptApi/index.html'
    }
  ]
}

function sidebar(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'About',
      items: enData.about
    },
    {
      text: 'User Manual',
      collapsed: true,
      base: '/docs/um/',
      items: enData.userManual
    },
    {
      text: 'Example',
      base: '/examples/',
      items: enData.example
    },
    {
      text: 'Developer Manual',
      base: '/docs/dev/',
      collapsed: true,
      items: enData.developerManual
    }
  ]
}
