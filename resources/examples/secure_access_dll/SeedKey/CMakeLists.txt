cmake_minimum_required(VERSION 3.10)

# 设置项目名称和语言
project(SeedKey LANGUAGES CXX)

# 指定 C++ 标准
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS ON)

# set 64-bit build, only support 64-bit build
set(CMAKE_GENERATOR_PLATFORM x64)



add_library(GenerateKeyEx SHARED 
    KeyGenDll_GenerateKeyEx/GenerateKeyExImpl.cpp
)

add_library(GenerateKeyExOpt SHARED 
    KeyGenDll_GenerateKeyExOpt/GenerateKeyExOpt.cpp
)

target_include_directories(GenerateKeyEx PUBLIC 
    KeyGenDll_GenerateKeyEx
)

target_compile_definitions(GenerateKeyEx PRIVATE 
    KEYGENALGO_EXPORTS
)

target_compile_definitions(GenerateKeyExOpt PRIVATE 
    GENERATEKEYEXOPTIMPL_EXPORTS
)

target_include_directories(GenerateKeyExOpt PUBLIC 
    KeyGenDll_GenerateKeyExOpt
)




