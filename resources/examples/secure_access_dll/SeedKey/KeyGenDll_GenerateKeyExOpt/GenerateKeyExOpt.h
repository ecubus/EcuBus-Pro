//****************************************************************************************
//   File name: KeyGenAlgoExOpt.h
// Description: Abstract base class defines the interface for the key generation algorithm
//        Date: 2009-05-29
//   Copyright: Vector Informatik GmbH - 2003
//****************************************************************************************

#ifndef KEY_GEN_ALGO_INTERFACE_H
#define KEY_GEN_ALGO_INTERFACE_H

#if _MSC_VER > 1000
#pragma once
#endif


#ifdef GENERATEKEYEXOPTIMPL_EXPORTS
#define KEYGENALGO_API extern "C" __declspec(dllexport)
#else
#define KEYGENALGO_API __declspec(dllimport)
#endif

enum VKeyGenResultExOpt
{
  KGREO_Ok = 0,
  KGREO_BufferToSmall = 1,
  KGREO_SecurityLevelInvalid = 2,
  KGREO_VariantInvalid = 3,
  KGREO_UnspecifiedError = 4
};

// The client has to provide a keyArray buffer and has to transfer this buffer - 
// including its size - to the GenerateKey method. The method checks, if the size is
// sufficient. The client can discover the required size by examining the service used
// transfer the key to the ECU.
// Returns false if the key could not be generated:
//  -> keyArraySize to small
//  -> generation for specified security level not possible
//  -> variant unknown
KEYGENALGO_API VKeyGenResultExOpt GenerateKeyExOpt(
   const unsigned char* ipSeedArray, unsigned int iSeedArraySize,
   const unsigned int iSecurityLevel, const char* ipVariant, const char* ipOptions,
   unsigned char* iopKeyArray, unsigned int iMaxKeyArraySize, 
   unsigned int& oActualKeyArraySize);


#endif // KEY_GEN_ALGO_INTERFACE_H
