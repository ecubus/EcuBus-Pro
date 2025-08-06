#include "sa.h"
#include <exception>


typedef int (*GenerateKeyExOptFunc)(
    const unsigned char* ipSeedArray,
    unsigned int iSeedArraySize,
    const unsigned int iSecurityLevel,
    const char* ipVariant,
    const char* ipOptions,
    unsigned char* iopKeyArray,
    unsigned int iMaxKeyArraySize,
    unsigned int& oActualKeyArraySize
);

typedef int (*GenerateKeyExFunc)(
    const unsigned char* ipSeedArray,
    unsigned int iSeedArraySize,
    const unsigned int iSecurityLevel,
    const char* ipVariant,
    unsigned char* iopKeyArray,
    unsigned int iMaxKeyArraySize,
    unsigned int& oActualKeyArraySize
);


SeedKey::SeedKey() : hDll(NULL) {
}

SeedKey::~SeedKey() {
    Unload();
}

void SeedKey::LoadDLL(const char* path) {
    if (hDll) {
        Unload();
    }
    hDll = LoadLibrary(path);
    
}

void SeedKey::Unload() {
    if (hDll) {
        FreeLibrary(hDll);
        hDll = NULL;
    }
}

template<typename T>
T SeedKey::GetFunction(const char* funcName) {
    if (!hDll) {
        throw std::runtime_error("DLL not loaded");
    }

    T func = (T)GetProcAddress(hDll, funcName);
    if (!func) {
        return NULL;
    }
    return func;
}

int SeedKey::GenerateKeyExOpt(
    const unsigned char* ipSeedArray,
    unsigned int iSeedArraySize,
    const unsigned int iSecurityLevel,
    const char* ipVariant,
    const char* ipOptions,
    unsigned char* iopKeyArray,
    unsigned int iMaxKeyArraySize,
    unsigned int& oActualKeyArraySize
) {
    auto func = GetFunction<GenerateKeyExOptFunc>("GenerateKeyExOpt");
     if(!func) {
        return -1;
    }
    return func(
        ipSeedArray,
        iSeedArraySize,
        iSecurityLevel,
        ipVariant,
        ipOptions,
        iopKeyArray,
        iMaxKeyArraySize,
        oActualKeyArraySize
    );
}

int SeedKey::GenerateKeyEx(
    const unsigned char* ipSeedArray,
    unsigned int iSeedArraySize,
    const unsigned int iSecurityLevel,
    const char* ipVariant,
    unsigned char* iopKeyArray,
    unsigned int iMaxKeyArraySize,
    unsigned int& oActualKeyArraySize
) {
    auto func = GetFunction<GenerateKeyExFunc>("GenerateKeyEx");
    if(!func) {
        return -1;
    }
    return func(
        ipSeedArray,
        iSeedArraySize,
        iSecurityLevel,
        ipVariant,
        iopKeyArray,
        iMaxKeyArraySize,
        oActualKeyArraySize
    );
}

bool SeedKey::IsLoaded() const {
    return hDll != NULL;
}
