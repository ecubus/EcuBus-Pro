/*
 *                   Copyright 2003-2017 by KVASER AB, SWEDEN
 *                        WWW: http://www.kvaser.com
 *
 * This software is furnished under a license and may be used and copied
 * only in accordance with the terms of such license.
 */

/**
 * \file linlib.h
 * \brief  Definitions for the LINlib API.
 * \details
 * \defgroup grp_linlib              LINlib
 * \brief Library for interacting with the LIN bus
 * \defgroup lin_status_codes        Status Codes
 * \brief  Return codes from the LINlib functions
 * \ingroup grp_linlib
 * \defgroup lin_general             General
 * \brief Initialization, reading versions and other information
 * \ingroup grp_linlib
 * \defgroup LIN             LIN
 * \brief LIN related functions
 * \ingroup grp_linlib
 */

#ifndef __LINLIB_H
#define __LINLIB_H

 /**
  * LIN handle
  */
typedef int LinHandle;

/**
 * Invalid LIN handle
 */
#define linINVALID_HANDLE ((LinHandle)(-1))


/**
 * \ingroup lin_status_codes Status Codes
 * \anchor linERR_xxx
 *
 * Generally, a return code greater than or equal to zero means success. A
 * value less than zero means failure.
 *
 * @{
 */
typedef enum {
    linOK                  = 0, ///< OK - no error
    linERR_NOMSG           = -1, ///< No messages available

    /**
     * Handle not on-bus.<br>
     * Some functions requires that the handle is on-bus before being called, i.e \ref linRequestMessage().<br>
     * Call \ref linBusOn() to go on-bus.
     */
    linERR_NOTRUNNING      = -3,

    /**
     * Handle not off-bus.<br>
     * Some functions requires that the handle is off-bus before being called, i.e \ref linSetBitrate().<br>
     * Call \ref linBusOff() to go off-bus.
     */
    linERR_RUNNING         = -4,

    /**
     * Only for a master.<br>
     * A call to a function that only a master can execute, i.e \ref linRequestMessage().
     */
    linERR_MASTERONLY      = -5,

    /**
     * Only for a slave.<br>
     * A call to a function that only a slave can execute, i.e \ref linUpdateMessage().
     */
    linERR_SLAVEONLY       = -6,


    linERR_PARAM           = -7, ///< Error in parameter
    linERR_NOTFOUND        = -8, ///< Specified hardware not found. This error is reported when the LIN transceiver isn't powered up
    linERR_NOMEM           = -9, ///< Out of memory
    linERR_NOCHANNELS      = -10, ///< No channels avaliable
    linERR_TIMEOUT         = -11, ///< Timeout occurred
    linERR_NOTINITIALIZED  = -12, ///< Library not initialized
    linERR_NOHANDLES       = -13, ///< Can't get handle
    linERR_INVHANDLE       = -14, ///< Handle is invalid
    linERR_CANERROR        = -15, ///< Internal error in the driver
    linERR_ERRRESP         = -16, ///< There was an error response from the LIN interface
    linERR_WRONGRESP       = -17, ///< The LIN interface response wasn't the expected one
    linERR_DRIVER          = -18, ///< CAN driver type not supported
    linERR_DRIVERFAILED    = -19, ///< DeviceIOControl failed; use the Win32 GetLastError API to get the real (WIn32) error code.
    linERR_NOCARD          = -20, ///< The card was removed or not inserted
    linERR_LICENSE         = -21, ///< The license is not valid
    linERR_INTERNAL        = -22, ///< Internal error in the driver
    linERR_NO_ACCESS       = -23, ///< Access denied
    linERR_VERSION         = -24, ///< Function not supported in this version
    linERR_NO_REF_POWER    = -25, ///< Function not supported in this version
    linERR_NOT_IMPLEMENTED = -26  ///< The requested feature or function is not implemented in the device you are trying to use it on
} LinStatus;
/** @} */


// sizeof(LinMessageInfo) should be 68 for correct alignment
#include <pshpack1.h>

/**
 * In certain LIN bus API calls, the following structure is used to provide more
 * information about the LIN messages.
 *
 * \note The precision of the timing data given in us (microseconds) can be less
 * than one microsecond; for low bitrates the lowest bits might always be zero.
 *
 * \note The min and max values listed inside [] of the message timing values
 * can be calculated from the LIN specification by using the shortest (0 bytes)
 * or longest (8 bytes) messages at the lowest or highest allowed bitrate.
 *
 * \note The LIN interface will accept messages that are a bit out-of-bounds as
 * well.
 */
typedef struct {
    /**
     * Kvaser DRV Lin timestamp - Timestamp in milliseconds of the falling edge of
     * the synch break of the message. Uses the canlib CAN timer.
     *
     * Kvaser LIN Leaf timestamp - Timestamp in milliseconds of the falling edge
     * of the synch break of the message. Uses the canlib CAN timer.
     *
     * \note All Kvaser Leaf with Kvaser MagiSync&tm; are synchronized
     * (also with CAN channels).
     */
    unsigned long timestamp;

    /**
     * Length of the synch break in microseconds.
     * [650 .. 13000],  [400 .. 8000] for a wakeup signal.
     */
    unsigned long synchBreakLength;

    /**
     * The total frame length in microseconds; from the synch break to the
     * end of the crc. [2200 .. 173600]
     */
    unsigned long frameLength;

    /**
     * The bitrate of the message in bits per seconds.
     * Range [1000 .. 20000] (plus some margin)
     */
    unsigned long bitrate;

    /**
     * The checksum as read from the LIN bus. Might not
     * match the data in case of \ref LIN_CSUM_ERROR.
     */
    unsigned char checkSum;

    /**
     * The id with parity of the message as read from the
     * LIN bus. Might be invalid in case of \ref LIN_PARITY_ERROR.
     */
    unsigned char idPar;

    unsigned short z; ///< Dummy for alignment

    /**
     * Time in microseconds of the falling edges in the
     * synch byte relative the falling edge of the start bit.
     *
     * \note Not supported by all devices.
     */
    unsigned long synchEdgeTime[4];

    /**
     * Start time in microseconds of each data byte. In case of 8-byte messages,
     * the crc time isn't included (but can be deduced from frameLength).
     *
     * \note Not supported by all devices.
     */
     unsigned long byteTime[8];
} LinMessageInfo;

#include <poppack.h>


/**
 * \name LIN message flags
 * \anchor LIN_xxx
 * The following flags can be returned from \ref linReadMessage() and
 * \ref linReadMessageWait().
 *
 * @{
 */
#define LIN_TX           1 ///< The message was something we transmitted on the bus
#define LIN_RX           2 ///< The message was something we received from the bus
#define LIN_WAKEUP_FRAME 4 ///< A wake up frame was received. Id/msg/dlc are undefined
#define LIN_NODATA       8 ///< No data, only a header
#define LIN_CSUM_ERROR   16 ///< Checksum error
#define LIN_PARITY_ERROR 32 ///< ID parity error
#define LIN_SYNCH_ERROR  64 ///< A synch error
#define LIN_BIT_ERROR    128 ///< Bit error when transmitting
/** @} */


/**
 * \name Flags for linGetChannelData()
 * \anchor linCHANNELDATA_xxx
 *
 * These defines are used in \ref linGetChannelData().
 *
 *  @{
 */

  /**
   * This define is used in \ref linGetChannelData(), \a buffer
   * mentioned below refers to this functions argument.
   *
   * \a buffer points to a 64-bit (8 bytes) area which receives the firmware
   * revision number on the card. This number consists of four 16-bit words:
   * the major revision, the minor revision, the release number and the build
   * number, listed in order from the most significant to the least
   * significant.
   */
#define linCHANNELDATA_CARD_FIRMWARE_REV 9
/** @} */


/**
 * Macro for determining if a flag field contains a LIN error flag bit.
 */
#define LINERROR(f) ((f) & (LIN_NODATA | LIN_CSUM_ERROR | LIN_SYNCH_ERROR | LIN_BIT_ERROR))


// Define LINLIBAPI unless it's done already.
// (linlib.c provides its own definition of LINLIBAPI before including this file.)
//
#ifndef LINLIBAPI
#define LINLIBAPI __stdcall
#endif

#ifdef __cplusplus
extern "C" {
#endif

/**
 * \ingroup lin_general
 * This function initializes the LIN library and must be called before any other
 * LIN function is called. If this function isn't called, subsequent calls to
 * the other LIN functions will return \ref linERR_NOTINITIALIZED.
 *
 * \sa \ref linOpenChannel()
 */
void LINLIBAPI linInitializeLibrary(void);

/**
 * \ingroup lin_general
 * This function de-initializes the LIN library. After this function is called /ref linInitializeLibrary must be called before any other
 * LIN function is called.
 *
 */
void LINLIBAPI linUnloadLibrary(void);


/**
 * \ingroup LIN
 * Retrieves the transceiver information for a CAN channel. The application
 * typically uses this call to find out whether a particular CAN channel has a
 * LIN interface connected to it.
 * For a Kvaser LIN Leaf it retrieves the transceiver type and device information.
 *
 * This function call will open the CAN channel, but no CAN messages are
 * transmitted on it. In other words, it's risk-free to use even if no LIN
 * interface is connected, or if the channel is connected to a CAN system.
 *
 * \note Attempts to use the channel for LIN communication will be meaningful
 * only if \ref linGetTransceiverData() stores \ref canTRANSCEIVER_TYPE_LIN or
 * \ref canTRANSCEIVER_TYPE_CANFD_LIN in \a ttype.
 *
 * \note A LIN interface need not be powered for this call to succeed.
 *
 * \note The information may not always be accurate. Especially after changing
 * transceiver on a running LAPcan card, you should go on-bus and off-bus again
 * to be sure the transceiver information is updated.
 *
 * \param[in]  channel The number of a CAN channel for which the transceiver
 *                     data will be retrieved.
 * \param[out] eanNo   A pointer to an array of 8 bytes where the EAN number of
 *                     the LIN interface will be stored.
 * \param[out] serNo   A pointer to an array of 8 bytes where the serial number
 *                     of the LIN interface will be stored.
 * \param[out] ttype   A pointer to an integer where the transceiver type will
 *                     be stored.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 * \sa \ref linGetFirmwareVersion()
 */
LinStatus LINLIBAPI linGetTransceiverData(int channel, unsigned char eanNo[8],
                                          unsigned char serNo[8], int *ttype);

/**
 * \ingroup LIN
 * Open a channel to a LIN interface.
 *
 * \note The device must be powered from the LIN side.
 *
 * \param[in] channel  The number of the channel. Channel numbering is hardware
 *                     dependent.
 *                     This is the same channel number as used by \ref canOpenChannel().
 * \param[in] flags    Either one of the following values: \ref LIN_MASTER or
 *                     \ref LIN_SLAVE.
 *
 * \return If the call succeeds, a handle to the opened channel is returned.
 * The handle is an integer greater than or equal to zero.
 *
 * \return If the call fails, the return value is a negative integer indicating
 * an error code. See \ref linERR_xxx for a list of possible error codes.
 *
 * \sa \ref linClose()
 */
LinHandle LINLIBAPI linOpenChannel(int channel, int flags);


/**
 * \name Flags for linOpenChannel()
 * \anchor linOpenChannelFlags_xxx
 *
 * These defines are used in \ref linOpenChannel().
 *
 * @{
 */
#define LIN_MASTER 1 ///< The LIN interface will be a LIN master
#define LIN_SLAVE  2 ///< The LIN interface will be a LIN slave
/** @} */


/**
 * \ingroup LIN
 * Closes an open handle to a LIN channel. The handle becomes invalid and can
 * not be used in subsequent calls to the LIN functions.
 *
 * \param[in] h        A handle to an open LIN channel.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 * \sa \ref linOpenChannel()
 */
LinStatus LINLIBAPI linClose(LinHandle h);


/**
 * \ingroup lin_general
 * This function retrieves the LIBLIB library version.
 *
 * \param[out] major  A pointer to an int where the major version number
 *                    of the library is stored.
 * \param[out] minor  A pointer to an int where the minor version number
 *                    of the library is stored.
 * \param[out] build  A pointer to an int where the bulid number of the
 *                    library is stored.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 */
LinStatus LINLIBAPI linGetVersion(int *major, int *minor, int *build);


/**
 * \ingroup lin_general
 * This function retrieves the firmware version from the LIN interface.
 *
 * \note For newer interfaces a call to this function will return \ref linERR_NOT_IMPLEMENTED.<br>
 * Use \ref linGetChannelData() with \ref linCHANNELDATA_CARD_FIRMWARE_REV instead.
 *
 * \note The version numbers aren't valid until \ref linBusOn() has been called.
 *
 * \note The firmware in the LIN interface is divided into two parts, the boot
 * code and the application. The boot code is used only when reprogramming
 * (reflashing) the LIN interface. The application handles all LIN communication.
 *
 * \note Version numbers are, since the precambric era, divided into a major
 * version number, a minor version number and a build number. These are usually
 * written like, for example, 3.2.12. Here the major number is 3, the minor
 * number 2 and the build number 12.
 *
 * \param[in]  h             A handle to an open LIN channel.
 * \param[out] bootVerMajor  A pointer to a byte where the major version number
 *                           of the boot code is stored.
 * \param[out] bootVerMinor  A pointer to a byte where the minor version number
 *                           of the boot code is stored.
 * \param[out] bootVerBuild  A pointer to a byte where the build number of the
 *                           boot code is stored.
 * \param[out] appVerMajor   A pointer to a byte where the major version number
 *                           of the application code is stored.
 * \param[out] appVerMinor   A pointer to a byte where the minor version number
 *                           of the application code is stored.
 * \param[out] appVerBuild   A pointer to a byte where the build number of the application is stored.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 */
LinStatus LINLIBAPI linGetFirmwareVersion(LinHandle h,
                                          unsigned char *bootVerMajor,
                                          unsigned char *bootVerMinor,
                                          unsigned char *bootVerBuild,
                                          unsigned char *appVerMajor,
                                          unsigned char *appVerMinor,
                                          unsigned char *appVerBuild);



/**
 * \ingroup lin_general
 *
 * This function can be used to retrieve certain pieces of information about a channel.
 *
 * \note You must pass a channel number and not a channel handle.
 *
 * \param[in]  channel  The number of the channel you are interested in. Channel
 *                        numbers are integers in the interval beginning at 0
 * \param[in]  item  This parameter specifies what data to obtain for the
 *                        specified channel. The value is one of the constants
 *                        \ref linCHANNELDATA_xxx.
 * \param[out] buffer     The address of a buffer which is to receive the data.
 * \param[in]  bufsize    The size of the buffer to which the buffer parameter
 *                        points.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 */
LinStatus LINLIBAPI linGetChannelData(int channel, int item, void *buffer, size_t bufsize);

/**
 * \ingroup LIN
 * This function sets the bit rate for a master, or the initial bit rate for a
 * slave.
 *
 * \note The handle shall be off-bus.
 *
 * \note Supported bit rates according to the LIN standard are 1000 - 20000
 * bits per second. No check of the bps parameter is done inside LINlib.
 *
 * \param[in] h   A handle to an open LIN channel.
 * \param[in] bps Bit rate in bits per second.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 */
LinStatus LINLIBAPI linSetBitrate(LinHandle h, unsigned int bps);

/**
 * \ingroup LIN
 * Takes the specified handle on-bus.
 *
 * \note Settings and slave message buffers will be reset to the default if<br>
 *       used on a channel that is already on-bus.
 *
 * \param[in] h A handle to an open LIN channel.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 * \sa \ref linBusOff()
 */
LinStatus LINLIBAPI linBusOn(LinHandle h);

/**
 * \ingroup LIN
 * Takes the specified handle off-bus.
 *
 * \note Settings and slave message buffers will be reset to the default
 *
 * \param[in] h A handle to an open LIN channel.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 * \sa \ref linBusOn()
 */
LinStatus LINLIBAPI linBusOff(LinHandle h);

/**
 * \ingroup lin_general
 * Return the current timer value (used for timestamps)
 *
 * \note For convenience, this call returns the timer value instead of passing
 * it in a parameter. This means that if the call fails, it will still return
 * a value (which then is the error code, type casted to a long unsigned
 * integer - e.g. 0xFFFFFFF2 for \ref linERR_INVHANDLE.
 *
 * \param[in] h        A handle to an open LIN channel.
 * \return If the call succeeds, the present timer value is returned.
 */
unsigned long LINLIBAPI linReadTimer(LinHandle h);

/**
 * \ingroup LIN
 * Write a LIN message.
 * It is advisable to wait until the message is echoed by \ref linReadMessage()
 * before transmitting a new message, or in case of a schedule table being used,
 * transmit the next message when the previous one is known to be complete.
 *
 * \note Only available in master mode.
 *
 * \param[in] h        A handle to an open LIN channel.
 * \param[in] id       The identifier of the LIN message.
 * \param[in] msg      A pointer to a buffer containing the data of the LIN
 *                     message.
 * \param[in] dlc      The length of the LIN message.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 * \sa \ref linWriteSync()
 * \sa \ref section_user_guide_lin_frame_identifiers
 */
LinStatus LINLIBAPI linWriteMessage(LinHandle h, unsigned int id, const void *msg,
                                    unsigned int dlc);

/**
 * \ingroup LIN
 * This function writes a LIN message header to the LIN bus. A slave in the
 * system is then expected to fill in the header with data.
 *
 * \note This call is only available in master mode.
 *
 * \param[in] h        A handle to an open LIN channel.
 * \param[in] id       The identifier of the LIN message.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 * \sa \ref section_user_guide_lin_frame_identifiers
 */
LinStatus LINLIBAPI linRequestMessage(LinHandle h, unsigned int id);

/**
 * \ingroup LIN
 * Read a message from the LIN interface. If a message is available for
 * reception, \ref linOK is returned. This is a non-blocking call. If no message
 * is available in the LIN interface, an error code is returned.
 *
 * \note This call will also return echoes of what the LIN interface is
 * transmitting with \ref linWriteMessage. In other words, the LIN interface can hear
 * itself.
 *
 * \param[in] h        A handle to an open LIN channel.
 * \param[out] id      A pointer to an integer where the identifier of the
 *                     received LIN message will be stored.
 * \param[out] msg     A pointer to a buffer where the data of the LIN message
 *                     will be stored.
 * \param[out] dlc     A pointer to an integer where the length of the received
 *                     LIN message will be stored.
 * \param[out] flags   A combination of zero or more of the \ref LIN_xxx flags.
 * \param[out] msgInfo A pointer to a \ref LinMessageInfo struct where data about the
 *                     received LIN message will be stored.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 * \sa \ref linReadMessageWait()
 */
LinStatus LINLIBAPI linReadMessage(LinHandle h, unsigned int *id, void *msg,
                                   unsigned int *dlc, unsigned int *flags,
                                   LinMessageInfo *msgInfo);

/**
 * \ingroup LIN
 * Read a message from the LIN interface. If a message is available for
 * reception, \ref linOK is returned. This is a blocking call. It waits until a
 * message is received in the LIN interface, or the specified timeout period
 * elapses.
 *
 * \note This call will also return echoes of what the LIN interface is
 * transmitting with \ref linWriteMessage(). In other words, the LIN interface can
 * hear itself.
 *
 * \param[in] h        A handle to an open LIN channel.
 * \param[in] timeout  The maximum number of milliseconds to wait for a message
 *                     to be received by the LIN interface.
 * \param[out] id      A pointer to an integer where the identifier of the
 *                     received LIN message will be stored.
 * \param[out] msg     A pointer to a buffer where the data of the LIN message
 *                     will be stored.
 * \param[out] dlc     A pointer to an integer where the length of the received
 *                     LIN message will be stored.
 * \param[out] flags   A combination of zero or more of the \ref LIN_xxx flags.
 * \param[out] msgInfo A pointer to a \ref LinMessageInfo struct where data about the
 *                     received LIN message will be stored.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 * \sa \ref linReadMessage()
 */
LinStatus LINLIBAPI linReadMessageWait(LinHandle h, unsigned int *id, void *msg,
                                       unsigned int *dlc, unsigned int *flags,
                                       LinMessageInfo *msgInfo, unsigned long timeout);

/**
 * \ingroup LIN
 * This function updates a message buffer in a slave. The contents of the
 * message buffer will be used the next time the slave is polled for the
 * specified LIN message id.
 *
 * \note The handle shall be on-bus.
 *
 * \param[in] h        A handle to an open LIN channel.
 * \param[in] id       The identifier of the LIN message.
 * \param[in] msg      A pointer to a buffer containing the data of the LIN message.
 * \param[in] dlc      The length of the LIN message.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 * \sa \ref linClearMessage()
 * \sa \ref section_user_guide_lin_frame_identifiers
 */
LinStatus LINLIBAPI linUpdateMessage(LinHandle h, unsigned int id, const void *msg,
                                     unsigned int dlc);


/**
 * \ingroup LIN
 * Using this function, it is possible to use the LIN interface to create
 * corrupted LIN messages. You call the function once for each LIN identifier
 * that should be affected.
 *
 * To return to normal mode, either restart the LIN interface (by going off bus
 * and on the bus again) or call the function with delay and \a cFlags set to zero.
 *
 * \note The handle shall be on-bus.
 * \note Not supported by all devices.
  *
 * \param[in] h        A handle to an open LIN channel.
 * \param[in] id       The identifier of the LIN message.
 * \param[in] cFlags   One or more of the \ref LIN_MSG_DISTURB_xxx or \ref LIN_MSG_USE_xxx flags.
 * \param[in] delay    The delay parameter will result in a delay of this many
 *                     bittimes after the header and before the first data byte.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 * \sa \ref linSetupLIN()
 */
LinStatus LINLIBAPI linSetupIllegalMessage(LinHandle h, unsigned int id,
                                           unsigned int cFlags, unsigned int delay);

/**
 * \name LIN illegal message flags
 * \anchor LIN_MSG_DISTURB_xxx
 * @{
 */
/**
 * The checksum of transmitted messages will be inverted (and consequently illegal.)
 */
#define LIN_MSG_DISTURB_CSUM   1
/**
 * The two parity bits will be inverted (and consequently illegal.)
 * Used only in master mode.
 */
#define LIN_MSG_DISTURB_PARITY 2
/** @} */


/**
 * \name LIN message parity
 * \anchor LIN_MSG_USE_xxx
 * @{
 */
/**
 * Use standard (1.x) parity for the specified msg
 */
#define LIN_MSG_USE_STANDARD_PARITY 0x04
/**
 * Use enhanced (2.x) parity for the specified msg
 */
#define LIN_MSG_USE_ENHANCED_PARITY 0x08
/** @} */

/**
 * \ingroup LIN
 * This function changes various settings on a handle that is on-bus.
 * When going on-bus, the bit rate and the flag values listed below are set to
 * the default value (either as hard-coded in the firmware, or as stored in the
 * non-volatile memory of the LIN Interface).
 *
 * With this function, you can do one or more of the following things:
 * - Select checksum according to LIN 2.0
 * - Turn variable message length off. The message length then will depend on
 *   the message ID.
 *
 * In master mode it is also possible to change the bit rate without going off
 * bus first.
 *
 * \note The handle shall be on-bus.
 * \note It is supported in firmware version 2.5.1 and later.
 * \note For LIN 2.0 compliance, you must specify both \ref LIN_ENHANCED_CHECKSUM
 * and \ref LIN_VARIABLE_DLC.
 *
 * \param[in] h        A handle to an open LIN channel.
 * \param[in] lFlags   One or more of the following flags:
 *                     \ref LIN_ENHANCED_CHECKSUM, \ref LIN_VARIABLE_DLC
 * \param bps          Specifies the bit rate in bits per second. This parameter
 *                     can be used only in master mode. The bit rate is set
 *                     without going off bus.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 * \sa \ref linSetupIllegalMessage()
 * \sa \ref section_user_guide_lin_frame_identifiers
 */
LinStatus LINLIBAPI linSetupLIN(LinHandle h, unsigned int lFlags, unsigned int bps);


/**
 * \name LIN setup
 * @{
 */
/**
 * When specified, the LIN interface will use the "enhanced" checksum according
 * to LIN 2.0. Note that (as per the LIN 2.0 spec) the enhanced checksum is not
 * used on the diagnostic frames even if the \ref LIN_ENHANCED_CHECKSUM setting
 * is in effect.
 *
 * The default value is OFF.
 */
#define LIN_ENHANCED_CHECKSUM  1
/**
 * When specified, turns variable message length on, so the the message length
 * will depend on the message ID.
 *
 * The default value is ON.
 */
#define LIN_VARIABLE_DLC       2
/** @} */

/**
 * \ingroup LIN
 * Write a wakeup frame.
 *
 * If count is zero, one single wakeup frame is transmitted. If count > 1,
 * several wakeup frames are transmitted spaced with 'interval' bittimes.
 * The LIN interface will interrupt the sequence when a LIN message or another
 * command is received. The stream of wakeups will be recived as incoming
 * messages with the LIN_RX flag bit set.
 *
 * \note Maximum value of count is 255 (0xFF).
 * \note Maximum value of interval is either 255 (0xFF) or 65535 (0xFFFF) depending on device.
 *
 * \param[in] h        A handle to an open LIN channel.
 * \param[in] count    The number of wakeup frames to send.
 * \param[in] interval The time, in bit times, between the wakeup frames.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 */
LinStatus LINLIBAPI linWriteWakeup(LinHandle h, unsigned int count,
                                   unsigned int interval);


/**
 * \ingroup LIN
 * Clear a message buffer for a LIN slave. The message buffer will not answer
 * next time it is polled.
 *
 * \param[in] h        A handle to an open LIN channel.
 * \param[in] id       The LIN message id for which the corresponding buffer
 *                     will be cleared.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 */
LinStatus LINLIBAPI linClearMessage(LinHandle h, unsigned int id);

/**
 * \ingroup LIN
 * Call this function to make sure all messages transmitted to the
 * LIN Interface has been received by it.
 *
 * When messages are transmitted to the LIN Interface, they are queued by
 * the driver before appearing on the LIN bus.
 *
 * The function returns \ref linOK if all writes are done, \ref linERR_TIMEOUT in
 * case of timeout or possibly some other error code.
 *
 * If the LIN Interface is in master mode and a LIN message has been
 * transmitted with \ref linWriteMessage(), this function will return when
 * the LIN Interface has received the message. If another LIN message is being
 * received or transmitted, the message will not be transmitted on the
 * LIN bus at once. And even if the LIN Interface is idle, the header of the new
 * message will just have been started when \ref linWriteSync() returns.
 *
 * After calling \ref linUpdateMessage() and \ref linClearMessage() for a slave,
 * this function is enough to know that the LIN Interface is updated.
 *
 * After \ref linWriteMessage(), it is advisable to wait until the message is
 * echoed by \ref linReadMessage() before transmitting a new message, or in
 * case of a schedule table being used, transmit the next message when
 * the previous one is known to be complete.
 *
 * When, in master mode, a message should be transmitted after a poll
 * (reception) is done, it might be necessary to call \ref linWriteMessage()
 * before the result is received via \ref linReadMessage() as the LIN Interface waits
 * up to the maximum frame length before knowing a received message is
 * complete. A new message to transmit will force completion if the
 * currently received one.
 *
 * \param[in]  h       A handle to an open LIN channel.
 * \param[in] timeout  The maximum number of milliseconds to wait for the queued
 *                     messages to be transmitted by the LIN interface.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 *
 * \sa \ref linWriteMessage()
 */
LinStatus LINLIBAPI linWriteSync(LinHandle h, unsigned long timeout);

/**
 * \ingroup LIN
 * Return the CAN handle given an open LIN handle
 *
 * \param[in]  h          A handle to an open LIN channel.
 * \param[out] canHandle  A pointer to an integer where the CAN handle will be
 *                        stored.
 *
 * \return \ref linOK (zero) if success
 * \return \ref linERR_xxx (negative) if failure
 */
LinStatus LINLIBAPI linGetCanHandle(LinHandle h, unsigned int *canHandle);

/**
* \page page_linlib LIN bus API (LINlib)
*
*  \tableofcontents
*
* \section section_user_guide_lin_lib_1 Description
* The LINlib library is used to interact with the LIN bus. Similar to the \ref
* page_canlib, it holds functions to set bus parameters, go bus on/off and
* read/write LIN messages.
*
* \section section_user_guide_lin_intro Using the LIN Bus
*
*   Using the LIN bus requires special hardware, e.g.
*   Kvaser Leaf Professional LIN, Kvaser Hybrid 2xCAN/LIN or
*   Kvaser Hybrid Pro 2xCAN/LIN.
*
*   The CAN API calls are not directly suitable for the LIN bus. Instead, a new
*   API is provided that enables you to use the LIN bus as easily as you use the
*   CAN bus. The function calls in the LIN API all have names starting with lin,
*   e.g \ref linReadMessage().
*
*   You will need to
*   \code
*     #include linlib.h
*   \endcode
*
*   in your programs, and link with linlib.dll (which, in turn, uses canlib32.dll).\n
*   On Linux, the files are called liblinlib.so and libcanlib.so respectively.
*
* \section section_user_guide_lin_frame_identifiers LIN Frame Identifiers
*
*   LIN frame identifiers range from ID 0x00 to 0x3F.
*   IDs 0x3E and 0x3F are reserved for future use.
*
*   IDs 0x3C and 0x3D are used for diagnostics frames and behave somewhat
*   differently compared to the regular frames.\n
*   0x3C is called the master request frame and 0x3D is called the slave
*   response frame.\n
*   Diagnostic frames should contain eight bytes of data and use the classic
*   checksum (even if \ref LIN_ENHANCED_CHECKSUM is specified).\n
*   0x3D is single shot and its slave message buffer is automatically cleared upon
*   reception of a 0x3C or 0x3D.
*
* \section section_user_guide_lin_where_to_go_from_here Where to go from here
* For more details, see the module \ref grp_linlib.
*
**/

#ifdef __cplusplus
}
#endif

#endif // __LINLIB_H

