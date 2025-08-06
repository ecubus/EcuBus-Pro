// KeyGeneration.cpp : Defines the entry point for the DLL application.
//

#include <windows.h>
#include "KeyGenAlgoInterfaceEx.h"



KEYGENALGO_API VKeyGenResultEx GenerateKeyEx(
      const unsigned char*  iSeedArray,     /* Array for the seed [in] */
      unsigned int          iSeedArraySize, /* Length of the array for the seed [in] */
      const unsigned int    iSecurityLevel, /* Security level [in] */
      const char*           iVariant,       /* Name of the active variant [in] */
      unsigned char*        ioKeyArray,     /* Array for the key [in, out] */
      unsigned int          iKeyArraySize,  /* Maximum length of the array for the key [in] */
      unsigned int&         oSize           /* Length of the key [out] */
      )
{
    if (iSeedArraySize>iKeyArraySize)
      return KGRE_BufferToSmall;
    for (unsigned int i=0;i<iSeedArraySize;i++)
      ioKeyArray[i]=~iSeedArray[i];
    oSize=iSeedArraySize;
    
  return KGRE_Ok;
}



