#ifndef SEED_KEY_H
#define SEED_KEY_H

#include <windows.h>
#include <string>
#include <stdexcept>

// 函数指针类型定义
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

class SeedKey {
private:
    HMODULE hDll;

    template<typename T>
    T GetFunction(const char* funcName);

public:
    SeedKey();
    ~SeedKey();

    void LoadDLL(const char* path);
    void Unload();

    int GenerateKeyExOpt(
        const unsigned char* ipSeedArray,
        unsigned int iSeedArraySize,
        const unsigned int iSecurityLevel,
        const char* ipVariant,
        const char* ipOptions,
        unsigned char* iopKeyArray,
        unsigned int iMaxKeyArraySize,
        unsigned int& oActualKeyArraySize
    );

    int GenerateKeyEx(
        const unsigned char* ipSeedArray,
        unsigned int iSeedArraySize,
        const unsigned int iSecurityLevel,
        const char* ipVariant,
        unsigned char* iopKeyArray,
        unsigned int iMaxKeyArraySize,
        unsigned int& oActualKeyArraySize
    );

    bool IsLoaded() const;
};

#endif // SEED_KEY_H
