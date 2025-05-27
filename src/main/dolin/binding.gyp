{
    'targets': [
        {
            'target_name': 'kvaserLin',
           
            'configurations': {

            },
            'defines': [
                '__EXCEPTIONS'
            ],
           
            'conditions': [
                ['OS=="win"', {
                    'cflags': [

                    ],
                    'cflags_cc': [

                    ],
                     'include_dirs': [
                        './kvaser/inc',
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                     'sources': [
                        './kvaser/swig/lin_wrap.cxx', './kvaser/swig/lifn.cxx',
                    ],
                    'libraries': ['<(module_root_dir)/kvaser/lib/linlib.lib'],
                    'defines': ['DELAYLOAD_HOOK',],
                    'msvs_settings': {
                        'VCCLCompilerTool': {
                            'AdditionalOptions': ['/DELAYLOAD:linlib.dll'],
                            'ExceptionHandling': 1
                        }
                    },
                    'link_settings': {
                        'libraries': ['-DELAYLOAD:linlib.dll']
                    }
                },
                'OS=="linux"', {
                    'include_dirs': [
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
                    'cflags!': [ '-fno-exceptions' ],
                    'cflags_cc!': [ '-fno-exceptions' ],
                    'sources': [ './fake_linux.cxx' ],
                    'cflags': [ '-fexceptions' ],
                    'cflags_cc': [ '-fexceptions' ]
                },
                'OS=="mac"', {
                    'include_dirs': [
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
                    'cflags!': [ '-fno-exceptions' ],
                    'cflags_cc!': [ '-fno-exceptions' ],
                    'sources': [ './fake_mac.cxx' ],
                    'xcode_settings': {
                        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
                    }
                }
                ]
            ],
        },
        {
            'target_name': 'peakLin',
           
            'configurations': {

            },
            'defines': [
                '__EXCEPTIONS'
            ],
           
            'conditions': [
                ['OS=="win"', {
                    'cflags': [

                    ],
                    'cflags_cc': [

                    ],
                     'include_dirs': [
                        './peak/inc',
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                     'sources': [
                        './peak/swig/lin_wrap.cxx', './peak/swig/lifn.cxx',
                    ],
                    'libraries': ['<(module_root_dir)/peak/lib/PLinApi.lib'],
                    'defines': ['DELAYLOAD_HOOK',],
                    'msvs_settings': {
                        'VCCLCompilerTool': {
                            'AdditionalOptions': ['/DELAYLOAD:PLinApi.dll'],
                            'ExceptionHandling': 1
                        }
                    },
                    'link_settings': {
                        'libraries': ['-DELAYLOAD:PLinApi.dll']
                    }
                },
                'OS=="linux"', {
                    'include_dirs': [
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
                    'cflags!': [ '-fno-exceptions' ],
                    'cflags_cc!': [ '-fno-exceptions' ],
                    'sources': [ './fake_linux.cxx' ],
                    'cflags': [ '-fexceptions' ],
                    'cflags_cc': [ '-fexceptions' ]
                },
                'OS=="mac"', {
                    'include_dirs': [
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
                    'cflags!': [ '-fno-exceptions' ],
                    'cflags_cc!': [ '-fno-exceptions' ],
                    'sources': [ './fake_mac.cxx' ],
                    'xcode_settings': {
                        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
                    }
                }
                ]
            ],
        },
        {
            'target_name': 'toomossLin',
           
            'configurations': {

            },
            'defines': [
                '__EXCEPTIONS'
            ],
           
            'conditions': [
                ['OS=="win"', {
                    'cflags': [

                    ],
                    'cflags_cc': [

                    ],
                     'include_dirs': [
                        '<(module_root_dir)/../docan/toomoss/inc',
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                     'sources': [
                        './toomoss/swig/toomoss_wrap.cxx', './toomoss/swig/tsfn.cxx',
                    ],
                    'libraries': ['<(module_root_dir)/../docan/toomoss/lib/USB2XXX.lib'],
                    'defines': ['DELAYLOAD_HOOK',],
                    'msvs_settings': {
                        'VCCLCompilerTool': {
                            'AdditionalOptions': [ '/DELAYLOAD:USB2XXX.dll','/DELAYLOAD:libusb-1.0.dll' ],
                            'ExceptionHandling':1
                        }
                    },
                    'link_settings': {
                        'libraries': [ '-DELAYLOAD:USB2XXX.dll','-DELAYLOAD:libusb-1.0.dll' ]
                    }
                },
                'OS=="linux"', {
                    'include_dirs': [
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
                    'cflags!': [ '-fno-exceptions' ],
                    'cflags_cc!': [ '-fno-exceptions' ],
                    'sources': [ './fake_linux.cxx' ],
                    'cflags': [ '-fexceptions' ],
                    'cflags_cc': [ '-fexceptions' ]
                },
                'OS=="mac"', {
                    'include_dirs': [
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
                    'cflags!': [ '-fno-exceptions' ],
                    'cflags_cc!': [ '-fno-exceptions' ],
                    'sources': [ './fake_mac.cxx' ],
                    'xcode_settings': {
                        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
                    }
                }
                ]
            ],
        },
    ]
}
