
/*******************************************************************************
 *
 * Copyright (C) 2021 STMicroelectronics - All rights reserved
 *
 * This file is part of STM32CubeProgrammer project.
 *
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 *
 ******************************************************************************/ 
#ifndef DEVICEDATASTRUCTURE
#define DEVICEDATASTRUCTURE


#ifdef __cplusplus
extern "C" {
#endif

#define R_ACCESS    0x0
#define W_ACCESS    0x1
#define RW_ACCESS   0x2
#define RWE_ACCESS  0x3


/* -------------------------------------------------------------------------------------------- */
/*                                  OB Data Structures                                          */
/* -------------------------------------------------------------------------------------------- */

/**
 * \struct  bankSector.
 * \brief   This stucture indicates the sectors parameters.
 */
typedef struct bankSector
{
    unsigned int index   ;     /**< Index of the sector. */
    unsigned int size    ;     /**< Sector size. */
    unsigned int address ;     /**< Sector starting address. */
}bankSector;


/**
 * \struct  deviceBank.
 * \brief   This stucture defines the memory sectors for each bank.
 */
typedef struct deviceBank
{
    unsigned int sectorsNumber;    /**< Number of sectors of the considered bank. */
    bankSector* sectors;           /**< Sectors specifications #Bank_Sector. */
}deviceBank;


/**
 * \struct  storageStructure.
 * \brief   This stucture describes sotrage characterization.
 */
typedef struct storageStructure
{
    unsigned int banksNumber;      /**< Number of exsisted banks. */
    deviceBank* banks;             /**< Banks sectors definition #Device_Bank. */
}storageStructure;




/**
 * \struct  bitCoefficient_C.
 * \brief   This stucture indicates the coefficients to access to the adequate option bit.
 */
typedef struct bitCoefficient_C
{
    unsigned int multiplier;        /**< Bit multiplier. */
    unsigned int offset;            /**< Bit offset. */
}bitCoefficient_C;


/**
 * \struct  bitValue_C.
 * \brief   This stucture describes the option Bit value.
 */
typedef struct bitValue_C
{
    unsigned int value;             /**< Option bit value. */
    char description[1000];          /**< Option bit description. */
}bitValue_C;


/**
 * \struct  bit_C.
 * \brief   This stucture will be filled by values which characterize the device's option bytes.
 * \note    See product reference manual for more details.
 */
typedef struct bit_C
{
    char name[64];                  /**< Bit name such as RDP, BOR_LEV, nBOOT0... */
    char description[1000];          /**< Config description. */
    unsigned int wordOffset;       /**< Word offset. */
    unsigned int bitOffset;        /**< Bit offset. */
    unsigned int bitWidth;         /**< Number of bits build the option. */
    unsigned char access;           /**< Access Read/Write. */
    unsigned int valuesNbr;        /**< Number of possible values. */
    bitValue_C** values;            /**< Bits value, #BitValue_C. */
    bitCoefficient_C equation;      /**< Bits equation, #BitCoefficient_C. */
    unsigned char* reference;
    unsigned int bitValue;
    unsigned int valLine;
}bit_C;


/**
 * \struct  category_C
 * \brief   Get option bytes banks categories descriptions.
 */
typedef struct category_C
{
    char name[100];                 /**< Get category name such as Read Out Protection, BOR Level... */
    unsigned int bitsNbr;          /**< Get bits number of the considered category. */
    bit_C** bits;                   /**< Get internal bits descriptions. */
}category_C;


/**
 * \struct  bank_C
 * \brief   Get option bytes banks internal descriptions.
 * \note    STLINK and Bootloader interfaces have different addresses to access to option bytes registres.
 */
typedef struct bank_C
{
    unsigned int size;              /**< Bank size. */
    unsigned int address;           /**< Bank starting address. */
    unsigned char access;           /**< Bank access Read/Write. */
    unsigned int categoriesNbr;    /**< Number of option bytes categories. */
    category_C** categories;        /**< Get bank categories descriptions #Category_C. */
}bank_C;


/**
 * \struct  peripheral_C
 * \brief   Get peripheral option bytes general informations.
 */
typedef struct peripheral_C
{
    char name[64];                  /**< Peripheral name. */
    char description[1000];          /**< Peripheral description. */
    unsigned int banksNbr;         /**< Number of existed banks. */
    bank_C** banks;                 /**< Get banks descriptions #Bank_C. */
}peripheral_C;



#ifdef __cplusplus
}
#endif


#endif // DEVICEDATASTRUCTURE

