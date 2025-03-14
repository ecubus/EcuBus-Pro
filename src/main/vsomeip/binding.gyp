{
    'targets': [

        {
            'target_name': 'vsomeip',
           
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
                        './swig/vsomeip_wrap.cxx',
                    ],
                    'libraries': ['<(module_root_dir)/lib/vsomeip3.lib','<(module_root_dir)/lib/vsomeip3-sd.lib','<(module_root_dir)/lib/vsomeip3-cfg.lib','<(module_root_dir)/lib/vsomeip3-e2e.lib'],
                    'defines': ['DELAYLOAD_HOOK',],
                    'msvs_settings': {
                        'VCCLCompilerTool': {
                            'AdditionalOptions': ['/DELAYLOAD:boost_log-vc141-mt-x64-1_66.dll','/DELAYLOAD:boost_thread-vc141-mt-x64-1_66.dll','/DELAYLOAD:boost_system-vc141-mt-x64-1_66.dll','/DELAYLOAD:vsomeip3-sd.dll','/DELAYLOAD:vsomeip3-cfg.dll','/DELAYLOAD:vsomeip3-e2e.dll','/DELAYLOAD:vsomeip3.dll'],
                            'ExceptionHandling': 1
                        }
                    },
                    'link_settings': {
                        'libraries': ['-DELAYLOAD:boost_log-vc141-mt-x64-1_66.dll','-DELAYLOAD:boost_thread-vc141-mt-x64-1_66.dll','-DELAYLOAD:boost_system-vc141-mt-x64-1_66.dll','-DELAYLOAD:vsomeip3-sd.dll','-DELAYLOAD:vsomeip3-cfg.dll','-DELAYLOAD:vsomeip3-e2e.dll','-DELAYLOAD:vsomeip3.dll']
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
