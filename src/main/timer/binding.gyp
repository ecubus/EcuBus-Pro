{
  "targets": [
    {
      "target_name": "precision_timer",
      "sources": [
        "precision_timer.cxx"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "conditions": [
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }],
        ["OS=='linux'", {
          "cflags": [
            "-std=c++17",
            "-fPIC"
          ],
          "cflags_cc": [
            "-std=c++17",
            "-fPIC"
          ],
          "libraries": [
            "-lpthread"
          ],
          "ldflags": [
            "-Wl,-rpath,'$$ORIGIN'"
          ]
        }]
      ]
    }
    
  ]
}
