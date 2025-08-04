import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export const shared = defineConfig({
  title: 'EcuBus-Pro',
  description: 'A powerful automotive ECU development tool',
  ignoreDeadLinks: true,
  lastUpdated: true,

  rewrites: {
    'docs/en/:rest*': 'docs/:rest*',
    'docs/zh/:rest*': 'zh/docs/:rest*',
    'README.md': 'index.md',
    'README.zh.md': 'zh/index.md',
    'resources/examples/:pkg/:slug*': 'examples/:pkg/:slug*'
  },

  sitemap: {
    hostname: 'https://app.whyengineer.com'
  },

  markdown: {
    math: false,
    codeTransformers: [
      // We use `[!!code` in demo to prevent transformation, here we revert it back.
      {
        postprocess(code) {
          return code.replace(/\[\!\!code/g, '[!code')
        }
      }
    ]
  },

  /* prettier-ignore */
  head: [
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        href: 'https://ecubus.oss-cn-chengdu.aliyuncs.com/img/logo256.png'
      }
    ],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en' }],
    [
      'meta',
      { property: 'og:title', content: 'EcuBus-Pro | A powerful automotive ECU development tool' }
    ],
    ['meta', { property: 'og:site_name', content: 'EcuBus-Pro' }],
    [
      'meta',
      {
        property: 'og:image',
        content: 'https://ecubus.oss-cn-chengdu.aliyuncs.com/img/logo256.png'
      }
    ],
    ['meta', { property: 'og:url', content: 'https://app.whyengineer.com' }],
    [
      'meta',
      { name: 'google-site-verification', content: '8p_3SCSQGHvWlpmik3zhY902wyQ0QwxQsHaBJocrxfA' }
    ],
    [
      'script',
      {},
      `
      window.__rum = {
    pid: 'fx08lzooek@df6c2cc04f6d757',
    endpoint: 'https://fx08lzooek-default-cn.rum.aliyuncs.com',
    // 设置环境信息，参考值：'prod' | 'gray' | 'pre' | 'daily' | 'local'
    env: 'prod', 
    // 设置路由模式， 参考值：'history' | 'hash'
    spaMode: 'history',
    collectors: {
     
      perf: false,
   
      webVitals: false,
     
      api: false,
   
      staticResource: true,
  
      jsError: false,
      
      consoleError: false,
     
      action: true,
    },
    // 链路追踪配置开关，默认关闭
    tracing: true,
  };
      `
    ],
    ['script', { src: 'https://sdk.rum.aliyuncs.com/v2/browser-sdk.js', crossorigin: 'anonymous' }],
    [
      'script',
      { src: 'https://lf9-cdn-tos.bytecdntp.com/cdn/expire-1-M/viewerjs/1.10.4/viewer.min.js' }
    ],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/viewerjs/1.10.4/viewer.min.css'
      }
    ],
    [
      'script',
      {},
      `
     
      // 初始化图片查看器
      function initImageViewer() {
        
        const container = document.querySelector('.content-container');
        if (!container) return;
       

        container.addEventListener('click', function(e) {
          if (e.target.tagName === 'IMG') {
            // Check if the image is inside an anchor tag
            if (e.target.closest('a')) {
              // If image is inside a link, let the default link behavior proceed
              return;
            }
            
            e.preventDefault();
            
            const images = Array.from(document.querySelectorAll('.content-container img'));
            const currentIndex = images.indexOf(e.target);
            
            const viewerContainer = document.createElement('div');
            viewerContainer.style.display = 'none';
            document.body.appendChild(viewerContainer);
            
            images.forEach(img => viewerContainer.appendChild(img.cloneNode(true)));
            
            const viewer = new Viewer(viewerContainer, {
              zoomRatio: 0.1,
              hidden: function() {
                viewer.destroy();
                document.body.removeChild(viewerContainer);
              }
            });
            
            viewer.show();
            viewer.view(currentIndex);
          }
        });
      }

      // 等待 VitePress 加载完成
      window.addEventListener('load', () => {
        // 初始化
        initImageViewer();

        
      });

      `
    ]
  ],

  themeConfig: {
    outline: {
      level: [2, 4]
    },
    editLink: {
      pattern: 'https://github.com/ecubus/EcuBus-Pro/edit/master/:path',
      text: 'Edit this page on GitHub'
    },
    search: {
      provider: 'algolia',
      options: {
        appId: 'KXFLA7UAD8',
        apiKey: '67edbcb2f3c63548c4bf738d61602a03',
        indexName: 'app-whyengineer'
      }
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/ecubus/EcuBus-Pro' }]
  }
})
