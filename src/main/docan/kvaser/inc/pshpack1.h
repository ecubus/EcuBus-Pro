/*
**                   Copyright 2005 by KVASER AB, SWEDEN
**                        WWW: http://www.kvaser.com
*/

/*
** Description:
**   This file sets the struct alignment to 1 byte and saves the old
**   alignment.  Many compilers provide a file similar to this one.
** -----------------------------------------------------------------------------
*/

#if ! (defined(lint) || defined(_lint) || defined(RC_INVOKED))
#  if defined(_MSC_VER)
#    if ( _MSC_VER > 800 ) || defined(_PUSHPOP_SUPPORTED)
#      pragma warning(disable:4103)
#      if !(defined( MIDL_PASS )) || defined( __midl )
#        pragma pack(push)
#      endif
#      pragma pack(1)
#    else
#      pragma warning(disable:4103)
#      pragma pack(push)
#      pragma pack(1)
#    endif
#  elif defined(__C166__)
#    pragma pack(1)
#  elif defined(__LCC__)
#    pragma pack(push, 1)
#  elif defined(__MWERKS__)
#    pragma pack(push, 1)
#  elif defined(__BORLANDC__)
#    if (__BORLANDC__ >= 0x460)
#      pragma nopackwarning
#      pragma pack(push, 1)
#    else
#      pragma option -a1
#    endif
#  elif defined (__IAR_SYSTEMS_ICC)
     /* IAR M16C 1.x */
#    pragma alignment(1)
#  elif defined (__IAR_SYSTEMS_ICC__)
     /* IAR M32C 2.x */
#    pragma pack(push, 1)
#  elif defined (__GNUC__) && defined(__m32c__)
     /* gcc 4.x m32c */
#    pragma align 1
#  elif defined(__GNUC__) && defined(__linux__)
#    pragma pack (1)
#  elif defined (__GNUC__) && defined(__arm__) && defined(__ARM_ARCH_4T__)
     /* Do nothing */
#  elif defined(__GCC__)
#    pragma pack(push, 1)
#  else
#    error Unsupported compiler. See the compiler docs for more info on its alignment pragmas.
#  endif
#endif /* ! (defined(lint) || defined(_lint) || defined(RC_INVOKED)) */

