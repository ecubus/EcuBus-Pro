{
    'targets': [

        {
            'target_name': 'dfu',
           
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
                        './inc',
                        "<!@(node -p \"require('node-addon-api').include\")"
                    ],
                     'sources': [
                        './swig/dfu_wrap.cxx',
                       
                    ],
                    'libraries': ['<(module_root_dir)/lib/CubeProgrammer_API.lib'],
                    'defines': ['DELAYLOAD_HOOK'],
                    'msvs_settings': {
                        'VCCLCompilerTool': {
                            'AdditionalOptions': ['/DELAYLOAD:CubeProgrammer_API.dll'],
                            'ExceptionHandling': 1
                        }
                    },
                    'link_settings': {
                        'libraries': ['-DELAYLOAD:CubeProgrammer_API.dll']
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
        
    ]
}
