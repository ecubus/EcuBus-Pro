{
    'targets': [
      
        {   
            'target_name': 'peak',
            'conditions': [
                ['OS=="win"', {
                    'include_dirs': [
                        './peak/inc',
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'configurations': { },
                    'defines': [
                        '__EXCEPTIONS'
                    ],
                    'sources': [
                        './peak/swig/peak_wrap.cxx',
                        './peak/swig/tsfn.cxx'
                    ],
                    'cflags': [ ],
                    'cflags_cc': [ ],
                    'libraries': ['<(module_root_dir)/peak/lib/PCAN-ISO-TP.lib','<(module_root_dir)/peak/lib/PCANBasic.lib'],
                    'defines': [ 'DELAYLOAD_HOOK' ],
                    'msvs_settings': {
                        'VCCLCompilerTool': {
                            'AdditionalOptions': [ '/DELAYLOAD:PCAN-ISO-TP.dll','/DELAYLOAD:PCANBasic.dll' ],
                            'ExceptionHandling':1
                        }
                    },
                    'link_settings': {
                        'libraries': [ '-DELAYLOAD:PCAN-ISO-TP.dll','-DELAYLOAD:PCANBasic.dll' ]
                    }
                },'OS=="linux"', {
                    'include_dirs': [
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
                    'cflags!': [ '-fno-exceptions' ],
                    'cflags_cc!': [ '-fno-exceptions' ],
                    'sources': [ './fake_linux.cxx' ],
                    'cflags': [ '-fexceptions' ],
                    'cflags_cc': [ '-fexceptions' ]
                }]
            ]
        },
        {   
            'target_name': 'kvaser',
            'conditions': [
                ['OS=="win"', {
                    'include_dirs': [
                        './kvaser/inc',
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'configurations': { },
                    'defines': [
                        '__EXCEPTIONS'
                    ],
                    'sources': [
                        './kvaser/swig/kvaser_wrap.cxx',
                        './kvaser/swig/tsfn.cxx'
                    ],
                    'cflags': [ ],
                    'cflags_cc': [ ],
                    'libraries': ['<(module_root_dir)/kvaser/lib/canlib32.lib'],
                    'defines': [ 'DELAYLOAD_HOOK' ],
                    'msvs_settings': {
                        'VCCLCompilerTool': {
                            'AdditionalOptions': [ '/DELAYLOAD:canlib32.dll' ],
                            'ExceptionHandling':1
                        }
                    },
                    'link_settings': {
                        'libraries': [ '-DELAYLOAD:canlib32.dll' ]
                    }
                },'OS=="linux"', {
                    'include_dirs': [
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
                    'cflags!': [ '-fno-exceptions' ],
                    'cflags_cc!': [ '-fno-exceptions' ],
                    'sources': [ './fake_linux.cxx' ],
                    'cflags': [ '-fexceptions' ],
                    'cflags_cc': [ '-fexceptions' ]
                }]
            ]
        },
        {   
            'target_name': 'zlg',
            'conditions': [
                ['OS=="win"', {
                    'include_dirs': [
                        './zlg/inc',
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'configurations': { },
                    'defines': [
                        '__EXCEPTIONS'
                    ],
                    'sources': [
                        './zlg/swig/zlg_wrap.cxx',
                        './zlg/swig/tsfn.cxx'
                    ],
                    'cflags': [ ],
                    'cflags_cc': [ ],
                    'libraries': ['<(module_root_dir)/zlg/lib/zlgcan.lib'],
                    'defines': [ 'DELAYLOAD_HOOK' ],
                    'msvs_settings': {
                        'VCCLCompilerTool': {
                            'AdditionalOptions': [ '/DELAYLOAD:zlgcan.dll','/DELAYLOAD:msvcp120.dll','/DELAYLOAD:msvcr120.dll' ],
                            'ExceptionHandling':1
                        }
                    },
                    'link_settings': {
                        'libraries': [ '-DELAYLOAD:zlgcan.dll','-DELAYLOAD:msvcp120.dll','-DELAYLOAD:msvcr120.dll' ]
                    }
                },'OS=="linux"', {
                    'include_dirs': [
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
                    'cflags!': [ '-fno-exceptions' ],
                    'cflags_cc!': [ '-fno-exceptions' ],
                    'sources': [ './fake_linux.cxx' ],
                    'cflags': [ '-fexceptions' ],
                    'cflags_cc': [ '-fexceptions' ]
                }]
            ]
        }
    ]
}