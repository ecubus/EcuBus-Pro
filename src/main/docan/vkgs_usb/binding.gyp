{
  'variables': {
    'use_udev%': 0
  },
  'targets': [
    {
      'target_name': 'vkgs_usb',
      'include_dirs': [
        './api',
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      'dependencies': [
        "<!(node -p \"require('node-addon-api').gyp\")",
        '../../../../node_modules/usb/libusb.gypi:libusb'
      ],
      'defines': [ 'NAPI_CPP_EXCEPTIONS' ],
      'sources': [
        './native/addon.cpp',
        './api/vkgs_usb.cpp'
      ],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      'cflags': [ '-fexceptions' ],
      'cflags_cc': [ '-fexceptions' ],
      'conditions': [
        ['OS=="win"', {
          'defines': [ 'WIN32_LEAN_AND_MEAN' ],
          'libraries': [ 'cfgmgr32.lib' ],
          'msvs_settings': {
            'VCCLCompilerTool': { 'ExceptionHandling': 1 }
          }
        }],
        ['OS=="mac"', {
          'xcode_settings': {
            'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
            'CLANG_CXX_LIBRARY': 'libc++',
            'OTHER_LDFLAGS': [
              '-framework', 'CoreFoundation',
              '-framework', 'IOKit',
              '-framework', 'Security'
            ]
          }
        }]
      ]
    }
  ]
}
