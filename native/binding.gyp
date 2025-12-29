{
  "targets": [
    {
      "target_name": "wipeAddon",
      "sources": [ 
        "wipeAddon.cpp",
        "wipeMethods/purge/ataSecureErase.cpp",
        "wipeMethods/purge/nvmeSanitize.cpp",
        "wipeMethods/purge/cryptoErase.cpp",
        "wipeMethods/destroy.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ["OS=='win'", {
          "defines": [ "_WIN32_WINNT=0x0A00" ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": [ "/std:c++17" ]
            }
          }
        }]
      ]
    }
  ]
}
