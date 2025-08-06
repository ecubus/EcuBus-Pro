//////////////////////////////////////////////////////////////////////////
/// Seed & Key DLL with extended interface and options argument
/// This is an example implementation for CANoe demo configuration "UDSsim"
//////////////////////////////////////////////////////////////////////////


#include <windows.h>
#include "GenerateKeyExOpt.h"

KEYGENALGO_API VKeyGenResultExOpt GenerateKeyExOpt(
  const unsigned char*  ipSeedArray,            // Array for the seed [in]
  unsigned int          iSeedArraySize,         // Length of the array for the seed [in]
  const unsigned int    iSecurityLevel,         // Security level [in]
  const char*           ipVariant,              // Name of the active variant [in]
  const char*           ipOptions,              // Optional parameter which might be used for OEM specific information [in]
  unsigned char*        iopKeyArray,            // Array for the key [in, out]
  unsigned int          iMaxKeyArraySize,       // Maximum length of the array for the key [in]
  unsigned int&         oActualKeyArraySize)    // Length of the key [out]
{
  // Check the input arguments
  if( iSecurityLevel == 0 || iSecurityLevel > 10)
    return KGREO_SecurityLevelInvalid;

  if( iMaxKeyArraySize < iSeedArraySize || 4 > iSeedArraySize)
    return KGREO_BufferToSmall;

  if( !ipSeedArray || !iopKeyArray || !ipOptions || strlen( ipOptions) < iSeedArraySize)
    return KGREO_UnspecifiedError;

  // Copy the input bytes to the output bytes
  memcpy( iopKeyArray, ipSeedArray, iSeedArraySize);

  // As an example each byte in the options array will be added to each byte of the seed array securityLevel times.
  for( unsigned int l = 0; l < iSecurityLevel; ++l)
  {
    for( unsigned int i = 0; i < iSeedArraySize; ++i)
      iopKeyArray[i] += ipOptions[i];
  }

  oActualKeyArraySize = iSeedArraySize;
  return KGREO_Ok;
}
