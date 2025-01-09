{
    'targets': [

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
                }

                ]
            ],
        },
        # {
        #     'target_name': 'delay',
        #     'include_dirs': [
        #         './delay',
        #         "<!@(node -p \"require('node-addon-api').include\")"
        #     ],
        #     'configurations': {

        #     },
        #     'defines': [
        #         '__EXCEPTIONS'
        #     ],
        #     'sources': [
        #         './delay/delay.cpp'
        #     ],
        #     'conditions': [
        #         ['OS=="win"', {
        #             'cflags': [

        #             ],
        #             'cflags_cc': [

        #             ],
                  
        #             'msvs_settings': {
        #                 'VCCLCompilerTool': {
        #                     'AdditionalOptions': [],
        #                     'ExceptionHandling': 1
        #                 }
        #             },
        #             'link_settings': {
        #                 'libraries': []
        #             }
        #         }

        #         ]
        #     ],
        # }
    ]
}
