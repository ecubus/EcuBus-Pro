{
  "targets": [
    {
      "target_name": "cmsis_dap",
      "defines": [ "__EXCEPTIONS" ],
      "conditions": [
        [ "OS==\"win\"", {
          "include_dirs": [
            "./inc",
            "<!@(node -p \"require('node-addon-api').include\")"
          ],
          "sources": [
            "./swig/cmsis_dap_wrap.cxx",
            "./src/cmsis_dap.cpp"
          ],
          "cflags!": [ "-fno-exceptions" ],
          "cflags_cc!": [ "-fno-exceptions" ],
          "cflags": [ ],
          "cflags_cc": [ ],
          "libraries": [
            "winusb.lib",
            "setupapi.lib"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          },
          "link_settings": {
            "libraries": [
              "winusb.lib",
              "setupapi.lib"
            ]
          }
        } ],
        [ "OS==\"linux\"", {
          "include_dirs": [
            "./inc",
            "<!@(node -p \"require('node-addon-api').include\")"
          ],
          "dependencies": [ "<!(node -p \"require('node-addon-api').gyp\")" ],
          "cflags!": [ "-fno-exceptions" ],
          "cflags_cc!": [ "-fno-exceptions" ],
          "sources": [ "./swig/cmsis_dap_wrap.cxx", "./src/cmsis_dap.cpp" ],
          "cflags": [ "-fexceptions" ],
          "cflags_cc": [ "-fexceptions" ]
        } ],
        [ "OS==\"mac\"", {
          "include_dirs": [
            "./inc",
            "<!@(node -p \"require('node-addon-api').include\")"
          ],
          "dependencies": [ "<!(node -p \"require('node-addon-api').gyp\")" ],
          "cflags!": [ "-fno-exceptions" ],
          "cflags_cc!": [ "-fno-exceptions" ],
          "sources": [ "./swig/cmsis_dap_wrap.cxx", "./src/cmsis_dap.cpp" ],
          "cflags": [ "-fexceptions" ],
          "cflags_cc": [ "-fexceptions" ],
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
          }
        } ]
      ]
    }
  ]
}
