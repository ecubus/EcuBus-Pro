{
    'targets': [   
        {
            'target_name': 'candle',
            'conditions': [
                ['OS=="win"', {
                    'include_dirs': [
                        './candle/api',
                        './toomoss/inc',
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                    'configurations': { },
                    'defines': [
                        '__EXCEPTIONS'
                    ],
                    'sources': [
                        './candle/swig/candle_wrap.cxx',
                        './candle/swig/tsfn.cxx',
                        './candle/api/candle.c',
                        './candle/api/candle_ctrl_req.c'
                    ],
                    'cflags': [ ],
                    'cflags_cc': [ ],
                    'libraries': [
                        'winusb.lib',
                        'setupapi.lib'
                    ],
                    'defines': [ 'DELAYLOAD_HOOK' ],
                    'msvs_settings': {
                        'VCCLCompilerTool': {
                            'AdditionalOptions': [ ],
                            'ExceptionHandling':1
                        }
                    },
                    'link_settings': {
                        'libraries': [
                            'winusb.lib',
                            'setupapi.lib'
                        ]
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
                },'OS=="mac"', {
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
                }]
            ]
        },
    #     {   
    #         'target_name': 'peak',
    #         'conditions': [
    #             ['OS=="win"', {
    #                 'include_dirs': [
    #                     './peak/inc',
    #                     "<!@(node -p \"require('node-addon-api').include\")"
    #                 ],
    #                 'configurations': { },
    #                 'defines': [
    #                     '__EXCEPTIONS'
    #                 ],
    #                 'sources': [
    #                     './peak/swig/peak_wrap.cxx',
    #                     './peak/swig/tsfn.cxx'
    #                 ],
    #                 'cflags': [ ],
    #                 'cflags_cc': [ ],
    #                 'libraries': ['<(module_root_dir)/peak/lib/PCAN-ISO-TP.lib','<(module_root_dir)/peak/lib/PCANBasic.lib'],
    #                 'defines': [ 'DELAYLOAD_HOOK' ],
    #                 'msvs_settings': {
    #                     'VCCLCompilerTool': {
    #                         'AdditionalOptions': [ '/DELAYLOAD:PCAN-ISO-TP.dll','/DELAYLOAD:PCANBasic.dll' ],
    #                         'ExceptionHandling':1
    #                     }
    #                 },
    #                 'link_settings': {
    #                     'libraries': [ '-DELAYLOAD:PCAN-ISO-TP.dll','-DELAYLOAD:PCANBasic.dll' ]
    #                 }
    #             },'OS=="linux"', {
    #                 'include_dirs': [
    #                     "<!@(node -p \"require('node-addon-api').include\")"
    #                 ],
    #                 'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
    #                 'cflags!': [ '-fno-exceptions' ],
    #                 'cflags_cc!': [ '-fno-exceptions' ],
    #                 'sources': [ './fake_linux.cxx' ],
    #                 'cflags': [ '-fexceptions' ],
    #                 'cflags_cc': [ '-fexceptions' ]
    #             },'OS=="mac"', {
    #                 'include_dirs': [
    #                     "<!@(node -p \"require('node-addon-api').include\")"
    #                 ],
    #                 'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
    #                 'cflags!': [ '-fno-exceptions' ],
    #                 'cflags_cc!': [ '-fno-exceptions' ],
    #                 'sources': [ './fake_mac.cxx' ],
    #                 'xcode_settings': {
    #                     'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
    #                 }
    #             }]
    #         ]
    #     },
    #     {   
    #         'target_name': 'kvaser',
    #         'conditions': [
    #             ['OS=="win"', {
    #                 'include_dirs': [
    #                     './kvaser/inc',
    #                     "<!@(node -p \"require('node-addon-api').include\")"
    #                 ],
    #                 'configurations': { },
    #                 'defines': [
    #                     '__EXCEPTIONS'
    #                 ],
    #                 'sources': [
    #                     './kvaser/swig/kvaser_wrap.cxx',
    #                     './kvaser/swig/tsfn.cxx'
    #                 ],
    #                 'cflags': [ ],
    #                 'cflags_cc': [ ],
    #                 'libraries': ['<(module_root_dir)/kvaser/lib/canlib32.lib'],
    #                 'defines': [ 'DELAYLOAD_HOOK' ],
    #                 'msvs_settings': {
    #                     'VCCLCompilerTool': {
    #                         'AdditionalOptions': [ '/DELAYLOAD:canlib32.dll' ],
    #                         'ExceptionHandling':1
    #                     }
    #                 },
    #                 'link_settings': {
    #                     'libraries': [ '-DELAYLOAD:canlib32.dll' ]
    #                 }
    #             },'OS=="linux"', {
    #                 'include_dirs': [
    #                     "<!@(node -p \"require('node-addon-api').include\")"
    #                 ],
    #                 'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
    #                 'cflags!': [ '-fno-exceptions' ],
    #                 'cflags_cc!': [ '-fno-exceptions' ],
    #                 'sources': [ './fake_linux.cxx' ],
    #                 'cflags': [ '-fexceptions' ],
    #                 'cflags_cc': [ '-fexceptions' ]
    #             },'OS=="mac"', {
    #                 'include_dirs': [
    #                     "<!@(node -p \"require('node-addon-api').include\")"
    #                 ],
    #                 'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
    #                 'cflags!': [ '-fno-exceptions' ],
    #                 'cflags_cc!': [ '-fno-exceptions' ],
    #                 'sources': [ './fake_mac.cxx' ],
    #                 'xcode_settings': {
    #                     'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
    #                 }
    #             }]
    #         ]
    #     },
    #     {   
    #         'target_name': 'zlg',
    #         'conditions': [
    #             ['OS=="win"', {
    #                 'include_dirs': [
    #                     './zlg/inc',
    #                     "<!@(node -p \"require('node-addon-api').include\")"
    #                 ],
    #                 'configurations': { },
    #                 'defines': [
    #                     '__EXCEPTIONS'
    #                 ],
    #                 'sources': [
    #                     './zlg/swig/zlg_wrap.cxx',
    #                     './zlg/swig/tsfn.cxx'
    #                 ],
    #                 'cflags': [ ],
    #                 'cflags_cc': [ ],
    #                 'libraries': ['<(module_root_dir)/zlg/lib/zlgcan.lib'],
    #                 'defines': [ 'DELAYLOAD_HOOK' ],
    #                 'msvs_settings': {
    #                     'VCCLCompilerTool': {
    #                         'AdditionalOptions': [ '/DELAYLOAD:zlgcan.dll','/DELAYLOAD:msvcp120.dll','/DELAYLOAD:msvcr120.dll' ],
    #                         'ExceptionHandling':1
    #                     }
    #                 },
    #                 'link_settings': {
    #                     'libraries': [ '-DELAYLOAD:zlgcan.dll','-DELAYLOAD:msvcp120.dll','-DELAYLOAD:msvcr120.dll' ]
    #                 }
    #             },'OS=="linux"', {
    #                 'include_dirs': [
    #                     "<!@(node -p \"require('node-addon-api').include\")"
    #                 ],
    #                 'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
    #                 'cflags!': [ '-fno-exceptions' ],
    #                 'cflags_cc!': [ '-fno-exceptions' ],
    #                 'sources': [ './fake_linux.cxx' ],
    #                 'cflags': [ '-fexceptions' ],
    #                 'cflags_cc': [ '-fexceptions' ]
    #             },'OS=="mac"', {
    #                 'include_dirs': [
    #                     "<!@(node -p \"require('node-addon-api').include\")"
    #                 ],
    #                 'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
    #                 'cflags!': [ '-fno-exceptions' ],
    #                 'cflags_cc!': [ '-fno-exceptions' ],
    #                 'sources': [ './fake_mac.cxx' ],
    #                 'xcode_settings': {
    #                     'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
    #                 }
    #             }]
    #         ]
    #     },
    #     {   
    #         'target_name': 'toomoss',
    #         'conditions': [
    #             ['OS=="win"', {
    #                 'include_dirs': [
    #                     './toomoss/inc',
    #                     "<!@(node -p \"require('node-addon-api').include\")"
    #                 ],
    #                 'configurations': { },
    #                 'defines': [
    #                     '__EXCEPTIONS'
    #                 ],
    #                 'sources': [
    #                     './toomoss/swig/toomoss_wrap.cxx',
    #                     './toomoss/swig/tsfn.cxx'
    #                 ],
    #                 'cflags': [ ],
    #                 'cflags_cc': [ ],
    #                 'libraries': ['<(module_root_dir)/toomoss/lib/USB2XXX.lib'],
    #                 'defines': [ 'DELAYLOAD_HOOK' ],
    #                 'msvs_settings': {
    #                     'VCCLCompilerTool': {
    #                         'AdditionalOptions': [ '/DELAYLOAD:USB2XXX.dll','/DELAYLOAD:libusb-1.0.dll' ],
    #                         'ExceptionHandling':1
    #                     }
    #                 },
    #                 'link_settings': {
    #                     'libraries': [ '-DELAYLOAD:USB2XXX.dll','-DELAYLOAD:libusb-1.0.dll' ]
    #                 }
    #             },'OS=="linux"', {
    #                 'include_dirs': [
    #                     "<!@(node -p \"require('node-addon-api').include\")"
    #                 ],
    #                 'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
    #                 'cflags!': [ '-fno-exceptions' ],
    #                 'cflags_cc!': [ '-fno-exceptions' ],
    #                 'sources': [ './fake_linux.cxx' ],
    #                 'cflags': [ '-fexceptions' ],
    #                 'cflags_cc': [ '-fexceptions' ]
    #             },'OS=="mac"', {
    #                 'include_dirs': [
    #                     "<!@(node -p \"require('node-addon-api').include\")"
    #                 ],
    #                 'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
    #                 'cflags!': [ '-fno-exceptions' ],
    #                 'cflags_cc!': [ '-fno-exceptions' ],
    #                 'sources': [ './fake_mac.cxx' ],
    #                 'xcode_settings': {
    #                     'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
    #                 }
    #             }]
    #         ]
    #     },
    #     {   
    #     'target_name': 'vector',
    #     'conditions': [
    #         ['OS=="win"', {
    #             'include_dirs': [
    #                 './vector/inc',
    #                 "<!@(node -p \"require('node-addon-api').include\")"
    #             ],
    #             'configurations': { },
    #             'defines': [
    #                 '__EXCEPTIONS'
    #             ],
    #             'sources': [
    #                 './vector/swig/vector_wrap.cxx',
    #                 './vector/swig/tsfn.cxx'
    #             ],
    #             'cflags': [ ],
    #             'cflags_cc': [ ],
    #             'libraries': ['<(module_root_dir)/vector/lib/vxlapi64.lib'],
    #             'defines': [ 'DELAYLOAD_HOOK' ],
    #             'msvs_settings': {
    #                 'VCCLCompilerTool': {
    #                     'AdditionalOptions': [ '/DELAYLOAD:vxlapi64.dll' ],
    #                     'ExceptionHandling':1
    #                 }
    #             },
    #             'link_settings': {
    #                 'libraries': [ '-DELAYLOAD:vxlapi64.dll' ]
    #             }
    #         },'OS=="linux"', {
    #             'include_dirs': [
    #                 "<!@(node -p \"require('node-addon-api').include\")"
    #             ],
    #             'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
    #             'cflags!': [ '-fno-exceptions' ],
    #             'cflags_cc!': [ '-fno-exceptions' ],
    #             'sources': [ './fake_linux.cxx' ],
    #             'cflags': [ '-fexceptions' ],
    #             'cflags_cc': [ '-fexceptions' ]
    #         },'OS=="mac"', {
    #             'include_dirs': [
    #                 "<!@(node -p \"require('node-addon-api').include\")"
    #             ],
    #             'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
    #             'cflags!': [ '-fno-exceptions' ],
    #             'cflags_cc!': [ '-fno-exceptions' ],
    #             'sources': [ './fake_mac.cxx' ],
    #             'xcode_settings': {
    #                 'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
    #             }
    #         }]
    #     ]
    # },
    ]
}