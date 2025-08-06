//  PCAN-ISO-TP_2016.h
//
//  ~~~~~~~~~~~~
//
//  PCAN-ISO-TP API 2016 (ISO 15765-2:2016)
//
//  ~~~~~~~~~~~~
//
//  ------------------------------------------------------------------
//	Last changed by:	$Author: Fabrice $
//  Last changed date:	$Date: 2023-09-01 14:03:50 +0200 (Fri, 01 Sep 2023) $
//
//  Language: ANSI-C
//  ------------------------------------------------------------------
//
//  Copyright (C) 2015  PEAK-System Technik GmbH, Darmstadt
//  more Info at http://www.peak-system.com
//
#ifndef __PCANISOTP2016_H__
#define __PCANISOTP2016_H__

// Include standard types
#include <stdint.h>
// Platform dependent inclusions
#ifdef __linux__
#ifndef __stdcall
#define __stdcall
#endif
#else
#include <tchar.h>
#endif

// Following file is not available in VS2010
//  #include <stdbool.h>
#ifndef _STDBOOL
#ifndef __cplusplus
#define bool	_Bool
#define false	0
#define true	1
#endif // __cplusplus
#endif

////////////////////////////////////////////////////////////
// Enums definition (compatible with PCAN-Basic API)
////////////////////////////////////////////////////////////

#ifndef __PCANBASICH__
// PCANBasic is not already included, define its constants
#ifndef __PCANBASIC_DEFS_H__
#define __PCANBASIC_DEFS_H__


////////////////////////////////////////////////////////////
// Value definitions
////////////////////////////////////////////////////////////

// Currently defined and supported PCAN channels
//
#define PCAN_NONEBUS                  0x00U  // Undefined/default value for a PCAN bus

#define PCAN_ISABUS1                  0x21U  // PCAN-ISA interface, channel 1
#define PCAN_ISABUS2                  0x22U  // PCAN-ISA interface, channel 2
#define PCAN_ISABUS3                  0x23U  // PCAN-ISA interface, channel 3
#define PCAN_ISABUS4                  0x24U  // PCAN-ISA interface, channel 4
#define PCAN_ISABUS5                  0x25U  // PCAN-ISA interface, channel 5
#define PCAN_ISABUS6                  0x26U  // PCAN-ISA interface, channel 6
#define PCAN_ISABUS7                  0x27U  // PCAN-ISA interface, channel 7
#define PCAN_ISABUS8                  0x28U  // PCAN-ISA interface, channel 8

#define PCAN_DNGBUS1                  0x31U  // PCAN-Dongle/LPT interface, channel 1

#define PCAN_PCIBUS1                  0x41U  // PCAN-PCI interface, channel 1
#define PCAN_PCIBUS2                  0x42U  // PCAN-PCI interface, channel 2
#define PCAN_PCIBUS3                  0x43U  // PCAN-PCI interface, channel 3
#define PCAN_PCIBUS4                  0x44U  // PCAN-PCI interface, channel 4
#define PCAN_PCIBUS5                  0x45U  // PCAN-PCI interface, channel 5
#define PCAN_PCIBUS6                  0x46U  // PCAN-PCI interface, channel 6
#define PCAN_PCIBUS7                  0x47U  // PCAN-PCI interface, channel 7
#define PCAN_PCIBUS8                  0x48U  // PCAN-PCI interface, channel 8
#define PCAN_PCIBUS9                  0x409U  // PCAN-PCI interface, channel 9
#define PCAN_PCIBUS10                 0x40AU  // PCAN-PCI interface, channel 10
#define PCAN_PCIBUS11                 0x40BU  // PCAN-PCI interface, channel 11
#define PCAN_PCIBUS12                 0x40CU  // PCAN-PCI interface, channel 12
#define PCAN_PCIBUS13                 0x40DU  // PCAN-PCI interface, channel 13
#define PCAN_PCIBUS14                 0x40EU  // PCAN-PCI interface, channel 14
#define PCAN_PCIBUS15                 0x40FU  // PCAN-PCI interface, channel 15
#define PCAN_PCIBUS16                 0x410U  // PCAN-PCI interface, channel 16

#define PCAN_USBBUS1                  0x51U  // PCAN-USB interface, channel 1
#define PCAN_USBBUS2                  0x52U  // PCAN-USB interface, channel 2
#define PCAN_USBBUS3                  0x53U  // PCAN-USB interface, channel 3
#define PCAN_USBBUS4                  0x54U  // PCAN-USB interface, channel 4
#define PCAN_USBBUS5                  0x55U  // PCAN-USB interface, channel 5
#define PCAN_USBBUS6                  0x56U  // PCAN-USB interface, channel 6
#define PCAN_USBBUS7                  0x57U  // PCAN-USB interface, channel 7
#define PCAN_USBBUS8                  0x58U  // PCAN-USB interface, channel 8
#define PCAN_USBBUS9                  0x509U  // PCAN-USB interface, channel 9
#define PCAN_USBBUS10                 0x50AU  // PCAN-USB interface, channel 10
#define PCAN_USBBUS11                 0x50BU  // PCAN-USB interface, channel 11
#define PCAN_USBBUS12                 0x50CU  // PCAN-USB interface, channel 12
#define PCAN_USBBUS13                 0x50DU  // PCAN-USB interface, channel 13
#define PCAN_USBBUS14                 0x50EU  // PCAN-USB interface, channel 14
#define PCAN_USBBUS15                 0x50FU  // PCAN-USB interface, channel 15
#define PCAN_USBBUS16                 0x510U  // PCAN-USB interface, channel 16

#define PCAN_PCCBUS1                  0x61U  // PCAN-PC Card interface, channel 1
#define PCAN_PCCBUS2                  0x62U  // PCAN-PC Card interface, channel 2

#define PCAN_LANBUS1                  0x801U  // PCAN-LAN interface, channel 1
#define PCAN_LANBUS2                  0x802U  // PCAN-LAN interface, channel 2
#define PCAN_LANBUS3                  0x803U  // PCAN-LAN interface, channel 3
#define PCAN_LANBUS4                  0x804U  // PCAN-LAN interface, channel 4
#define PCAN_LANBUS5                  0x805U  // PCAN-LAN interface, channel 5
#define PCAN_LANBUS6                  0x806U  // PCAN-LAN interface, channel 6
#define PCAN_LANBUS7                  0x807U  // PCAN-LAN interface, channel 7
#define PCAN_LANBUS8                  0x808U  // PCAN-LAN interface, channel 8
#define PCAN_LANBUS9                  0x809U  // PCAN-LAN interface, channel 9
#define PCAN_LANBUS10                 0x80AU  // PCAN-LAN interface, channel 10
#define PCAN_LANBUS11                 0x80BU  // PCAN-LAN interface, channel 11
#define PCAN_LANBUS12                 0x80CU  // PCAN-LAN interface, channel 12
#define PCAN_LANBUS13                 0x80DU  // PCAN-LAN interface, channel 13
#define PCAN_LANBUS14                 0x80EU  // PCAN-LAN interface, channel 14
#define PCAN_LANBUS15                 0x80FU  // PCAN-LAN interface, channel 15
#define PCAN_LANBUS16                 0x810U  // PCAN-LAN interface, channel 16

// Represent the PCAN error and status codes
//
#define PCAN_ERROR_OK                 0x00000U  // No error
#define PCAN_ERROR_XMTFULL            0x00001U  // Transmit buffer in CAN controller is full
#define PCAN_ERROR_OVERRUN            0x00002U  // CAN controller was read too late
#define PCAN_ERROR_BUSLIGHT           0x00004U  // Bus error: an error counter reached the 'light' limit
#define PCAN_ERROR_BUSHEAVY           0x00008U  // Bus error: an error counter reached the 'heavy' limit
#define PCAN_ERROR_BUSWARNING         PCAN_ERROR_BUSHEAVY // Bus error: an error counter reached the 'warning' limit
#define PCAN_ERROR_BUSPASSIVE         0x40000U  // Bus error: the CAN controller is error passive
#define PCAN_ERROR_BUSOFF             0x00010U  // Bus error: the CAN controller is in bus-off state
#define PCAN_ERROR_ANYBUSERR          (PCAN_ERROR_BUSWARNING | PCAN_ERROR_BUSLIGHT | PCAN_ERROR_BUSHEAVY | PCAN_ERROR_BUSOFF | PCAN_ERROR_BUSPASSIVE) // Mask for all bus errors
#define PCAN_ERROR_QRCVEMPTY          0x00020U  // Receive queue is empty
#define PCAN_ERROR_QOVERRUN           0x00040U  // Receive queue was read too late
#define PCAN_ERROR_QXMTFULL           0x00080U  // Transmit queue is full
#define PCAN_ERROR_REGTEST            0x00100U  // Test of the CAN controller hardware registers failed (no hardware found)
#define PCAN_ERROR_NODRIVER           0x00200U  // Driver not loaded
#define PCAN_ERROR_HWINUSE            0x00400U  // Hardware already in use by a Net
#define PCAN_ERROR_NETINUSE           0x00800U  // A Client is already connected to the Net
#define PCAN_ERROR_ILLHW              0x01400U  // Hardware handle is invalid
#define PCAN_ERROR_ILLNET             0x01800U  // Net handle is invalid
#define PCAN_ERROR_ILLCLIENT          0x01C00U  // Client handle is invalid
#define PCAN_ERROR_ILLHANDLE          (PCAN_ERROR_ILLHW | PCAN_ERROR_ILLNET | PCAN_ERROR_ILLCLIENT)  // Mask for all handle errors
#define PCAN_ERROR_RESOURCE           0x02000U  // Resource (FIFO, Client, timeout) cannot be created
#define PCAN_ERROR_ILLPARAMTYPE       0x04000U  // Invalid parameter
#define PCAN_ERROR_ILLPARAMVAL        0x08000U  // Invalid parameter value
#define PCAN_ERROR_UNKNOWN            0x10000U  // Unknown error
#define PCAN_ERROR_ILLDATA            0x20000U  // Invalid data, function, or action
#define PCAN_ERROR_ILLMODE            0x80000U  // Driver object state is wrong for the attempted operation
#define PCAN_ERROR_CAUTION            0x2000000U  // An operation was successfully carried out, however, irregularities were registered
#define PCAN_ERROR_INITIALIZE         0x4000000U  // Channel is not initialized [Value was changed from 0x40000 to 0x4000000]
#define PCAN_ERROR_ILLOPERATION       0x8000000U  // Invalid operation [Value was changed from 0x80000 to 0x8000000]

// PCAN devices
//
#define PCAN_NONE                     0x00U  // Undefined, unknown or not selected PCAN device value
#define PCAN_PEAKCAN                  0x01U  // PCAN Non-PnP devices. NOT USED WITHIN PCAN-Basic API
#define PCAN_ISA                      0x02U  // PCAN-ISA, PCAN-PC/104, and PCAN-PC/104-Plus
#define PCAN_DNG                      0x03U  // PCAN-Dongle
#define PCAN_PCI                      0x04U  // PCAN-PCI, PCAN-cPCI, PCAN-miniPCI, and PCAN-PCI Express
#define PCAN_USB                      0x05U  // PCAN-USB and PCAN-USB Pro
#define PCAN_PCC                      0x06U  // PCAN-PC Card
#define PCAN_VIRTUAL                  0x07U  // PCAN Virtual hardware. NOT USED WITHIN PCAN-Basic API
#define PCAN_LAN                      0x08U  // PCAN Gateway devices

// PCAN parameters
//
#define PCAN_DEVICE_ID                0x01U  // Device identifier parameter
#define PCAN_5VOLTS_POWER             0x02U  // 5-Volt power parameter
#define PCAN_RECEIVE_EVENT            0x03U  // PCAN receive event handler parameter
#define PCAN_MESSAGE_FILTER           0x04U  // PCAN message filter parameter
#define PCAN_API_VERSION              0x05U  // PCAN-Basic API version parameter
#define PCAN_CHANNEL_VERSION          0x06U  // PCAN device channel version parameter
#define PCAN_BUSOFF_AUTORESET         0x07U  // PCAN Reset-On-Busoff parameter
#define PCAN_LISTEN_ONLY              0x08U  // PCAN Listen-Only parameter
#define PCAN_LOG_LOCATION             0x09U  // Directory path for log files
#define PCAN_LOG_STATUS               0x0AU  // Debug-Log activation status
#define PCAN_LOG_CONFIGURE            0x0BU  // Configuration of the debugged information (LOG_FUNCTION_***)
#define PCAN_LOG_TEXT                 0x0CU  // Custom insertion of text into the log file
#define PCAN_CHANNEL_CONDITION        0x0DU  // Availability status of a PCAN-Channel
#define PCAN_HARDWARE_NAME            0x0EU  // PCAN hardware name parameter
#define PCAN_RECEIVE_STATUS           0x0FU  // Message reception status of a PCAN-Channel
#define PCAN_CONTROLLER_NUMBER        0x10U  // CAN-Controller number of a PCAN-Channel
#define PCAN_TRACE_LOCATION           0x11U  // Directory path for PCAN trace files
#define PCAN_TRACE_STATUS             0x12U  // CAN tracing activation status
#define PCAN_TRACE_SIZE               0x13U  // Configuration of the maximum file size of a CAN trace
#define PCAN_TRACE_CONFIGURE          0x14U  // Configuration of the trace file storing mode (TRACE_FILE_***)
#define PCAN_CHANNEL_IDENTIFYING      0x15U  // Physical identification of a USB based PCAN-Channel by blinking its associated LED
#define PCAN_CHANNEL_FEATURES         0x16U  // Capabilities of a PCAN device (FEATURE_***)
#define PCAN_BITRATE_ADAPTING         0x17U  // Using of an existing bit rate (PCAN-View connected to a channel)
#define PCAN_BITRATE_INFO             0x18U  // Configured bit rate as Btr0Btr1 value
#define PCAN_BITRATE_INFO_FD          0x19U  // Configured bit rate as TPCANBitrateFD string
#define PCAN_BUSSPEED_NOMINAL         0x1AU  // Configured nominal CAN Bus speed as Bits per seconds
#define PCAN_BUSSPEED_DATA            0x1BU  // Configured CAN data speed as Bits per seconds
#define PCAN_IP_ADDRESS               0x1CU  // Remote address of a LAN channel as string in IPv4 format
#define PCAN_LAN_SERVICE_STATUS       0x1DU  // Status of the Virtual PCAN-Gateway Service
#define PCAN_ALLOW_STATUS_FRAMES      0x1EU  // Status messages reception status within a PCAN-Channel
#define PCAN_ALLOW_RTR_FRAMES         0x1FU  // RTR messages reception status within a PCAN-Channel
#define PCAN_ALLOW_ERROR_FRAMES       0x20U  // Error messages reception status within a PCAN-Channel
#define PCAN_INTERFRAME_DELAY         0x21U  // Delay, in microseconds, between sending frames
#define PCAN_ACCEPTANCE_FILTER_11BIT  0x22U  // Filter over code and mask patterns for 11-Bit messages
#define PCAN_ACCEPTANCE_FILTER_29BIT  0x23U  // Filter over code and mask patterns for 29-Bit messages
#define PCAN_IO_DIGITAL_CONFIGURATION 0x24U  // Output mode of 32 digital I/O pin of a PCAN-USB Chip. 1: Output-Active 0 : Output Inactive
#define PCAN_IO_DIGITAL_VALUE         0x25U  // Value assigned to a 32 digital I/O pins of a PCAN-USB Chip
#define PCAN_IO_DIGITAL_SET           0x26U  // Value assigned to a 32 digital I/O pins of a PCAN-USB Chip - Multiple digital I/O pins to 1 = High
#define PCAN_IO_DIGITAL_CLEAR         0x27U  // Clear multiple digital I/O pins to 0
#define PCAN_IO_ANALOG_VALUE          0x28U  // Get value of a single analog input pin
#define PCAN_FIRMWARE_VERSION         0x29U  // Get the version of the firmware used by the device associated with a PCAN-Channel
#define PCAN_ATTACHED_CHANNELS_COUNT  0x2AU  // Get the amount of PCAN channels attached to a system
#define PCAN_ATTACHED_CHANNELS        0x2BU  // Get information about PCAN channels attached to a system
#define PCAN_ALLOW_ECHO_FRAMES        0x2CU  // Echo messages reception status within a PCAN-Channel
#define PCAN_DEVICE_PART_NUMBER       0x2DU  // Get the part number associated to a device

// DEPRECATED parameters
//
#define PCAN_DEVICE_NUMBER            PCAN_DEVICE_ID  // Deprecated parameter. Use PCAN_DEVICE_ID instead

// PCAN parameter values
//
#define PCAN_PARAMETER_OFF            0x00U  // The PCAN parameter is not set (inactive)
#define PCAN_PARAMETER_ON             0x01U  // The PCAN parameter is set (active)
#define PCAN_FILTER_CLOSE             0x00U  // The PCAN filter is closed. No messages will be received
#define PCAN_FILTER_OPEN              0x01U  // The PCAN filter is fully opened. All messages will be received
#define PCAN_FILTER_CUSTOM            0x02U  // The PCAN filter is custom configured. Only registered messages will be received
#define PCAN_CHANNEL_UNAVAILABLE      0x00U  // The PCAN-Channel handle is illegal, or its associated hardware is not available
#define PCAN_CHANNEL_AVAILABLE        0x01U  // The PCAN-Channel handle is available to be connected (PnP Hardware: it means furthermore that the hardware is plugged-in)
#define PCAN_CHANNEL_OCCUPIED         0x02U  // The PCAN-Channel handle is valid, and is already being used
#define PCAN_CHANNEL_PCANVIEW         (PCAN_CHANNEL_AVAILABLE |  PCAN_CHANNEL_OCCUPIED) // The PCAN-Channel handle is already being used by a PCAN-View application, but is available to connect

#define LOG_FUNCTION_DEFAULT          0x00U    // Logs system exceptions / errors
#define LOG_FUNCTION_ENTRY            0x01U    // Logs the entries to the PCAN-Basic API functions
#define LOG_FUNCTION_PARAMETERS       0x02U    // Logs the parameters passed to the PCAN-Basic API functions
#define LOG_FUNCTION_LEAVE            0x04U    // Logs the exits from the PCAN-Basic API functions
#define LOG_FUNCTION_WRITE            0x08U    // Logs the CAN messages passed to the CAN_Write function
#define LOG_FUNCTION_READ             0x10U    // Logs the CAN messages received within the CAN_Read function
#define LOG_FUNCTION_ALL              0xFFFFU  // Logs all possible information within the PCAN-Basic API functions

#define TRACE_FILE_SINGLE             0x00U  // A single file is written until it size reaches PAN_TRACE_SIZE
#define TRACE_FILE_SEGMENTED          0x01U  // Traced data is distributed in several files with size PAN_TRACE_SIZE
#define TRACE_FILE_DATE               0x02U  // Includes the date into the name of the trace file
#define TRACE_FILE_TIME               0x04U  // Includes the start time into the name of the trace file
#define TRACE_FILE_OVERWRITE          0x80U  // Causes the overwriting of available traces (same name)

#define FEATURE_FD_CAPABLE            0x01U  // Device supports flexible data-rate (CAN-FD)
#define FEATURE_DELAY_CAPABLE         0x02U  // Device supports a delay between sending frames (FPGA based USB devices)
#define FEATURE_IO_CAPABLE            0x04U  // Device supports I/O functionality for electronic circuits (USB-Chip devices)

#define SERVICE_STATUS_STOPPED        0x01U  // The service is not running
#define SERVICE_STATUS_RUNNING        0x04U  // The service is running

// Other constants
//
#define MAX_LENGTH_HARDWARE_NAME      33     // Maximum length of the name of a device: 32 characters + terminator
#define MAX_LENGTH_VERSION_STRING     256    // Maximum length of a version string: 255 characters + terminator

// PCAN message types
//
#define PCAN_MESSAGE_STANDARD         0x00U  // The PCAN message is a CAN Standard Frame (11-bit identifier)
#define PCAN_MESSAGE_RTR              0x01U  // The PCAN message is a CAN Remote-Transfer-Request Frame
#define PCAN_MESSAGE_EXTENDED         0x02U  // The PCAN message is a CAN Extended Frame (29-bit identifier)
#define PCAN_MESSAGE_FD               0x04U  // The PCAN message represents a FD frame in terms of CiA Specs
#define PCAN_MESSAGE_BRS              0x08U  // The PCAN message represents a FD bit rate switch (CAN data at a higher bit rate)
#define PCAN_MESSAGE_ESI              0x10U  // The PCAN message represents a FD error state indicator(CAN FD transmitter was error active)
#define PCAN_MESSAGE_ECHO	          0x20U  // The PCAN message represents an echo CAN Frame
#define PCAN_MESSAGE_ERRFRAME         0x40U  // The PCAN message represents an error frame
#define PCAN_MESSAGE_STATUS           0x80U  // The PCAN message represents a PCAN status message

// LookUp Parameters
//
#define LOOKUP_DEVICE_TYPE          __T("devicetype")       // Lookup channel by Device type (see PCAN devices e.g. PCAN_USB)
#define LOOKUP_DEVICE_ID            __T("deviceid")         // Lookup channel by device id
#define LOOKUP_CONTROLLER_NUMBER    __T("controllernumber") // Lookup channel by CAN controller 0-based index
#define LOOKUP_IP_ADDRESS           __T("ipaddress")        // Lookup channel by IP address (LAN channels only)

// Frame Type / Initialization Mode
//
#define PCAN_MODE_STANDARD            PCAN_MESSAGE_STANDARD
#define PCAN_MODE_EXTENDED            PCAN_MESSAGE_EXTENDED

// Baud rate codes = BTR0/BTR1 register values for the CAN controller.
// You can define your own Baud rate with the BTROBTR1 register.
// Take a look at www.peak-system.com for our free software "BAUDTOOL"
// to calculate the BTROBTR1 register for every bit rate and sample point.
//
#define PCAN_BAUD_1M                  0x0014U  //   1 MBit/s
#define PCAN_BAUD_800K                0x0016U  // 800 kBit/s
#define PCAN_BAUD_500K                0x001CU  // 500 kBit/s
#define PCAN_BAUD_250K                0x011CU  // 250 kBit/s
#define PCAN_BAUD_125K                0x031CU  // 125 kBit/s
#define PCAN_BAUD_100K                0x432FU  // 100 kBit/s
#define PCAN_BAUD_95K                 0xC34EU  //  95,238 kBit/s
#define PCAN_BAUD_83K                 0x852BU  //  83,333 kBit/s
#define PCAN_BAUD_50K                 0x472FU  //  50 kBit/s
#define PCAN_BAUD_47K                 0x1414U  //  47,619 kBit/s
#define PCAN_BAUD_33K                 0x8B2FU  //  33,333 kBit/s
#define PCAN_BAUD_20K                 0x532FU  //  20 kBit/s
#define PCAN_BAUD_10K                 0x672FU  //  10 kBit/s
#define PCAN_BAUD_5K                  0x7F7FU  //   5 kBit/s

// Represents the configuration for a CAN bit rate
// Note:
//    * Each parameter and its value must be separated with a '='.
//    * Each pair of parameter/value must be separated using ','.
//
// Example:
//    f_clock=80000000,nom_brp=10,nom_tseg1=5,nom_tseg2=2,nom_sjw=1,data_brp=4,data_tseg1=7,data_tseg2=2,data_sjw=1
//
#define PCAN_BR_CLOCK                 __T("f_clock")
#define PCAN_BR_CLOCK_MHZ             __T("f_clock_mhz")
#define PCAN_BR_NOM_BRP               __T("nom_brp")
#define PCAN_BR_NOM_TSEG1             __T("nom_tseg1")
#define PCAN_BR_NOM_TSEG2             __T("nom_tseg2")
#define PCAN_BR_NOM_SJW               __T("nom_sjw")
#define PCAN_BR_NOM_SAMPLE            __T("nom_sam")
#define PCAN_BR_DATA_BRP              __T("data_brp")
#define PCAN_BR_DATA_TSEG1            __T("data_tseg1")
#define PCAN_BR_DATA_TSEG2            __T("data_tseg2")
#define PCAN_BR_DATA_SJW              __T("data_sjw")
#define PCAN_BR_DATA_SAMPLE           __T("data_ssp_offset")

// Type of PCAN (Non-PnP) hardware
//
#define PCAN_TYPE_ISA                 0x01U  // PCAN-ISA 82C200
#define PCAN_TYPE_ISA_SJA             0x09U  // PCAN-ISA SJA1000
#define PCAN_TYPE_ISA_PHYTEC          0x04U  // PHYTEC ISA
#define PCAN_TYPE_DNG                 0x02U  // PCAN-Dongle 82C200
#define PCAN_TYPE_DNG_EPP             0x03U  // PCAN-Dongle EPP 82C200
#define PCAN_TYPE_DNG_SJA             0x05U  // PCAN-Dongle SJA1000
#define PCAN_TYPE_DNG_SJA_EPP         0x06U  // PCAN-Dongle EPP SJA1000

#endif	// __PCANBASIC_DEFS_H__
#endif	// __PCANBASICH__

// required definitions from PCANBASIC 4.6
#ifndef PCAN_MESSAGE_ECHO
#define PCAN_MESSAGE_ECHO	          0x20U  // The PCAN message represents an echo CAN Frame
#endif

// Represents currently defined and supported PCANTP handle (a.k.a. channels)
typedef enum _cantp_handle {
	PCANTP_HANDLE_NONEBUS = PCAN_NONEBUS,	// Undefined/default value for a PCAN bus

	PCANTP_HANDLE_ISABUS1 = PCAN_ISABUS1,	// PCAN-ISA interface, channel 1
	PCANTP_HANDLE_ISABUS2 = PCAN_ISABUS2,	// PCAN-ISA interface, channel 2
	PCANTP_HANDLE_ISABUS3 = PCAN_ISABUS3,	// PCAN-ISA interface, channel 3
	PCANTP_HANDLE_ISABUS4 = PCAN_ISABUS4,	// PCAN-ISA interface, channel 4
	PCANTP_HANDLE_ISABUS5 = PCAN_ISABUS5,	// PCAN-ISA interface, channel 5
	PCANTP_HANDLE_ISABUS6 = PCAN_ISABUS6,	// PCAN-ISA interface, channel 6
	PCANTP_HANDLE_ISABUS7 = PCAN_ISABUS7,	// PCAN-ISA interface, channel 7
	PCANTP_HANDLE_ISABUS8 = PCAN_ISABUS8,	// PCAN-ISA interface, channel 8

	PCANTP_HANDLE_DNGBUS1 = PCAN_DNGBUS1,	// PCAN-Dongle/LPT interface, channel 1

	PCANTP_HANDLE_PCIBUS1 = PCAN_PCIBUS1,	// PCAN-PCI interface, channel 1
	PCANTP_HANDLE_PCIBUS2 = PCAN_PCIBUS2,	// PCAN-PCI interface, channel 2
	PCANTP_HANDLE_PCIBUS3 = PCAN_PCIBUS3,	// PCAN-PCI interface, channel 3
	PCANTP_HANDLE_PCIBUS4 = PCAN_PCIBUS4,	// PCAN-PCI interface, channel 4
	PCANTP_HANDLE_PCIBUS5 = PCAN_PCIBUS5,	// PCAN-PCI interface, channel 5
	PCANTP_HANDLE_PCIBUS6 = PCAN_PCIBUS6,	// PCAN-PCI interface, channel 6
	PCANTP_HANDLE_PCIBUS7 = PCAN_PCIBUS7,	// PCAN-PCI interface, channel 7
	PCANTP_HANDLE_PCIBUS8 = PCAN_PCIBUS8,	// PCAN-PCI interface, channel 8
	PCANTP_HANDLE_PCIBUS9 = PCAN_PCIBUS9,	// PCAN-PCI interface, channel 9
	PCANTP_HANDLE_PCIBUS10 = PCAN_PCIBUS10, // PCAN-PCI interface, channel 10
	PCANTP_HANDLE_PCIBUS11 = PCAN_PCIBUS11, // PCAN-PCI interface, channel 11
	PCANTP_HANDLE_PCIBUS12 = PCAN_PCIBUS12, // PCAN-PCI interface, channel 12
	PCANTP_HANDLE_PCIBUS13 = PCAN_PCIBUS13, // PCAN-PCI interface, channel 13
	PCANTP_HANDLE_PCIBUS14 = PCAN_PCIBUS14, // PCAN-PCI interface, channel 14
	PCANTP_HANDLE_PCIBUS15 = PCAN_PCIBUS15, // PCAN-PCI interface, channel 15
	PCANTP_HANDLE_PCIBUS16 = PCAN_PCIBUS16, // PCAN-PCI interface, channel 16

	PCANTP_HANDLE_USBBUS1 = PCAN_USBBUS1,	// PCAN-USB interface, channel 1
	PCANTP_HANDLE_USBBUS2 = PCAN_USBBUS2,	// PCAN-USB interface, channel 2
	PCANTP_HANDLE_USBBUS3 = PCAN_USBBUS3,	// PCAN-USB interface, channel 3
	PCANTP_HANDLE_USBBUS4 = PCAN_USBBUS4,	// PCAN-USB interface, channel 4
	PCANTP_HANDLE_USBBUS5 = PCAN_USBBUS5,	// PCAN-USB interface, channel 5
	PCANTP_HANDLE_USBBUS6 = PCAN_USBBUS6,	// PCAN-USB interface, channel 6
	PCANTP_HANDLE_USBBUS7 = PCAN_USBBUS7,	// PCAN-USB interface, channel 7
	PCANTP_HANDLE_USBBUS8 = PCAN_USBBUS8,	// PCAN-USB interface, channel 8
	PCANTP_HANDLE_USBBUS9 = PCAN_USBBUS9,	// PCAN-USB interface, channel 9
	PCANTP_HANDLE_USBBUS10 = PCAN_USBBUS10, // PCAN-USB interface, channel 10
	PCANTP_HANDLE_USBBUS11 = PCAN_USBBUS11, // PCAN-USB interface, channel 11
	PCANTP_HANDLE_USBBUS12 = PCAN_USBBUS12, // PCAN-USB interface, channel 12
	PCANTP_HANDLE_USBBUS13 = PCAN_USBBUS13, // PCAN-USB interface, channel 13
	PCANTP_HANDLE_USBBUS14 = PCAN_USBBUS14, // PCAN-USB interface, channel 14
	PCANTP_HANDLE_USBBUS15 = PCAN_USBBUS15, // PCAN-USB interface, channel 15
	PCANTP_HANDLE_USBBUS16 = PCAN_USBBUS16, // PCAN-USB interface, channel 16

	PCANTP_HANDLE_PCCBUS1 = PCAN_PCCBUS1,	// PCAN-PC Card interface, channel 1
	PCANTP_HANDLE_PCCBUS2 = PCAN_PCCBUS2,	// PCAN-PC Card interface, channel 2

	PCANTP_HANDLE_LANBUS1 = PCAN_LANBUS1,	// PCAN-LAN interface, channel 1
	PCANTP_HANDLE_LANBUS2 = PCAN_LANBUS2,	// PCAN-LAN interface, channel 2
	PCANTP_HANDLE_LANBUS3 = PCAN_LANBUS3,	// PCAN-LAN interface, channel 3
	PCANTP_HANDLE_LANBUS4 = PCAN_LANBUS4,	// PCAN-LAN interface, channel 4
	PCANTP_HANDLE_LANBUS5 = PCAN_LANBUS5,	// PCAN-LAN interface, channel 5
	PCANTP_HANDLE_LANBUS6 = PCAN_LANBUS6,	// PCAN-LAN interface, channel 6
	PCANTP_HANDLE_LANBUS7 = PCAN_LANBUS7,	// PCAN-LAN interface, channel 7
	PCANTP_HANDLE_LANBUS8 = PCAN_LANBUS8,	// PCAN-LAN interface, channel 8
	PCANTP_HANDLE_LANBUS9 = PCAN_LANBUS9,	// PCAN-LAN interface, channel 9
	PCANTP_HANDLE_LANBUS10 = PCAN_LANBUS10,	// PCAN-LAN interface, channel 10
	PCANTP_HANDLE_LANBUS11 = PCAN_LANBUS11,	// PCAN-LAN interface, channel 11
	PCANTP_HANDLE_LANBUS12 = PCAN_LANBUS12,	// PCAN-LAN interface, channel 12
	PCANTP_HANDLE_LANBUS13 = PCAN_LANBUS13,	// PCAN-LAN interface, channel 13
	PCANTP_HANDLE_LANBUS14 = PCAN_LANBUS14,	// PCAN-LAN interface, channel 14
	PCANTP_HANDLE_LANBUS15 = PCAN_LANBUS15,	// PCAN-LAN interface, channel 15
	PCANTP_HANDLE_LANBUS16 = PCAN_LANBUS16,	// PCAN-LAN interface, channel 16
} cantp_handle;

// Represents the baudrate register for the PCANTP channel
typedef enum _cantp_baudrate {
	PCANTP_BAUDRATE_1M = PCAN_BAUD_1M,		// Channel Baudrate 1 MBit/s
	PCANTP_BAUDRATE_800K = PCAN_BAUD_800K,	// Channel Baudrate 800 kBit/s
	PCANTP_BAUDRATE_500K = PCAN_BAUD_500K,	// Channel Baudrate 500 kBit/s
	PCANTP_BAUDRATE_250K = PCAN_BAUD_250K,	// Channel Baudrate 250 kBit/s
	PCANTP_BAUDRATE_125K = PCAN_BAUD_125K,	// Channel Baudrate 125 kBit/s
	PCANTP_BAUDRATE_100K = PCAN_BAUD_100K,	// Channel Baudrate 100 kBit/s
	PCANTP_BAUDRATE_95K = PCAN_BAUD_95K,	// Channel Baudrate 95,238 kBit/s
	PCANTP_BAUDRATE_83K = PCAN_BAUD_83K,	// Channel Baudrate 83,333 kBit/s
	PCANTP_BAUDRATE_50K = PCAN_BAUD_50K,	// Channel Baudrate 50 kBit/s
	PCANTP_BAUDRATE_47K = PCAN_BAUD_47K,	// Channel Baudrate 47,619 kBit/s
	PCANTP_BAUDRATE_33K = PCAN_BAUD_33K,	// Channel Baudrate 33,333 kBit/s
	PCANTP_BAUDRATE_20K = PCAN_BAUD_20K,	// Channel Baudrate 20 kBit/s
	PCANTP_BAUDRATE_10K = PCAN_BAUD_10K,	// Channel Baudrate 10 kBit/s
	PCANTP_BAUDRATE_5K = PCAN_BAUD_5K,		// Channel Baudrate 5 kBit/s
} cantp_baudrate;

// Type of PCAN (non plug-n-play) hardware
typedef enum _cantp_hwtype {
	PCANTP_HWTYPE_ISA = PCAN_TYPE_ISA,					// PCAN-ISA 82C200
	PCANTP_HWTYPE_ISA_SJA = PCAN_TYPE_ISA_SJA,			// PCAN-ISA SJA1000
	PCANTP_HWTYPE_ISA_PHYTEC = PCAN_TYPE_ISA_PHYTEC,	// PHYTEC ISA
	PCANTP_HWTYPE_DNG = PCAN_TYPE_DNG,					// PCAN-Dongle 82C200
	PCANTP_HWTYPE_DNG_EPP = PCAN_TYPE_DNG_EPP,			// PCAN-Dongle EPP 82C200
	PCANTP_HWTYPE_DNG_SJA = PCAN_TYPE_DNG_SJA,			// PCAN-Dongle SJA1000
	PCANTP_HWTYPE_DNG_SJA_EPP = PCAN_TYPE_DNG_SJA_EPP,	// PCAN-Dongle EPP SJA1000
} cantp_hwtype;

// PCAN devices
typedef enum _cantp_device {
	PCANTP_DEVICE_NONE = PCAN_NONE,			// Undefined, unknown or not selected PCAN device value
	PCANTP_DEVICE_PEAKCAN = PCAN_PEAKCAN,	// PCAN Non-Plug&Play devices. NOT USED WITHIN PCAN-Basic API
	PCANTP_DEVICE_ISA = PCAN_ISA,			// PCAN-ISA, PCAN-PC/104, and PCAN-PC/104-Plus
	PCANTP_DEVICE_DNG = PCAN_DNG,			// PCAN-Dongle
	PCANTP_DEVICE_PCI = PCAN_PCI,			// PCAN-PCI, PCAN-cPCI, PCAN-miniPCI, and PCAN-PCI Express
	PCANTP_DEVICE_USB = PCAN_USB,			// PCAN-USB and PCAN-USB Pro
	PCANTP_DEVICE_PCC = PCAN_PCC,			// PCAN-PC Card
	PCANTP_DEVICE_VIRTUAL = PCAN_VIRTUAL,	// PCAN Virtual hardware. NOT USED WITHIN PCAN-Basic API
	PCANTP_DEVICE_LAN = PCAN_LAN,			// PCAN Gateway devices
} cantp_device;

// Represents the configuration for a CAN bit rate
// Note:
//    * Each parameter and its value must be separated with a '='.
//    * Each pair of parameter/value must be separated using ','.
//
// Example:
//    f_clock=80000000,nom_brp=10,nom_tseg1=5,nom_tseg2=2,nom_sjw=1,data_brp=4,data_tseg1=7,data_tseg2=2,data_sjw=1
//
#define PCANTP_BITRATE_CLOCK		PCAN_BR_CLOCK
#define PCANTP_BITRATE_CLOCK_MHZ	PCAN_BR_CLOCK_MHZ
#define PCANTP_BITRATE_NOM_BRP		PCAN_BR_NOM_BRP
#define PCANTP_BITRATE_NOM_TSEG1	PCAN_BR_NOM_TSEG1
#define PCANTP_BITRATE_NOM_TSEG2	PCAN_BR_NOM_TSEG2
#define PCANTP_BITRATE_NOM_SJW		PCAN_BR_NOM_SJW
#define PCANTP_BITRATE_NOM_SAMPLE	PCAN_BR_NOM_SAMPLE
#define PCANTP_BITRATE_DATA_BRP		PCAN_BR_DATA_BRP
#define PCANTP_BITRATE_DATA_TSEG1	PCAN_BR_DATA_TSEG1
#define PCANTP_BITRATE_DATA_TSEG2	PCAN_BR_DATA_TSEG2
#define PCANTP_BITRATE_DATA_SJW		PCAN_BR_DATA_SJW
#define PCANTP_BITRATE_DATA_SAMPLE	PCAN_BR_DATA_SAMPLE


////////////////////////////////////////////////////////////
// Enums definition for ISO-TP API
////////////////////////////////////////////////////////////

// Represents each group of errors a status can hold
typedef enum _cantp_statustype {
	PCANTP_STATUSTYPE_OK = 0x00,	// no error
	PCANTP_STATUSTYPE_ERR = 0x01,	// general error
	PCANTP_STATUSTYPE_BUS = 0x02,	// bus status
	PCANTP_STATUSTYPE_NET = 0x04,	// network status
	PCANTP_STATUSTYPE_INFO = 0x08,	// extra information
	PCANTP_STATUSTYPE_PCAN = 0x10,	// encapsulated PCAN-Basic status
} cantp_statustype;

// Represents the network result of the communication of an ISO-TP message (used in cantp_status).
//	note: maximum value that can be included in a cantp_status: 0x1F
typedef enum _cantp_netstatus {
	// ISO-TP network errors:
	PCANTP_NETSTATUS_OK = 0x00,				// No network error
	PCANTP_NETSTATUS_TIMEOUT_A = 0x01,		// timeout occured between 2 frames transmission (sender and receiver side)
	PCANTP_NETSTATUS_TIMEOUT_Bs = 0x02,		// sender side timeout while waiting for flow control frame
	PCANTP_NETSTATUS_TIMEOUT_Cr = 0x03,		// receiver side timeout while waiting for consecutive frame
	PCANTP_NETSTATUS_WRONG_SN = 0x04,		// unexpected sequence number
	PCANTP_NETSTATUS_INVALID_FS = 0x05,		// invalid or unknown FlowStatus
	PCANTP_NETSTATUS_UNEXP_PDU = 0x06,		// unexpected protocol data unit
	PCANTP_NETSTATUS_WFT_OVRN = 0x07,		// reception of flow control WAIT frame that exceeds the maximum counter defined by PCANTP_PARAMETER_WFT_MAX
	PCANTP_NETSTATUS_BUFFER_OVFLW = 0x08,	// buffer on the receiver side cannot store the data length (server side only)
	PCANTP_NETSTATUS_ERROR = 0x09,			// general error
	PCANTP_NETSTATUS_IGNORED = 0x0A,		// message was invalid and ignored
	PCANTP_NETSTATUS_TIMEOUT_As = 0x0B,		// sender side timeout while transmitting
	PCANTP_NETSTATUS_TIMEOUT_Ar = 0x0C,		// receiver side timeout while transmitting
	// NON ISO-TP related network results:
	PCANTP_NETSTATUS_XMT_FULL = 0x0D,		// transmit queue is full (failed too many times)
	PCANTP_NETSTATUS_BUS_ERROR = 0x0E,		// CAN bus error
	PCANTP_NETSTATUS_NO_MEMORY = 0x0F,		// memory allocation error
} cantp_netstatus;

// Represents the status of a CAN bus (used in cantp_status).
//	note: maximum value that can be included in a cantp_status: 0x1F
typedef enum _cantp_busstatus {
	PCANTP_BUSSTATUS_OK = 0x00,			// Bus is in active state
	PCANTP_BUSSTATUS_LIGHT = 0x01,		// Bus error: an error counter reached the 'light' limit
	PCANTP_BUSSTATUS_HEAVY = 0x02,		// Bus error: an error counter reached the 'heavy' limit
	PCANTP_BUSSTATUS_WARNING = PCANTP_BUSSTATUS_HEAVY,	// Bus error: an error counter reached the 'warning/heavy' limit
	PCANTP_BUSSTATUS_PASSIVE = 0x04,	// Bus error: the CAN controller is error passive
	PCANTP_BUSSTATUS_OFF = 0x08,		// Bus error: the CAN controller is in bus-off state
	PCANTP_BUSSTATUS_ANY = PCANTP_BUSSTATUS_LIGHT | PCANTP_BUSSTATUS_HEAVY | PCANTP_BUSSTATUS_WARNING | PCANTP_BUSSTATUS_PASSIVE | PCANTP_BUSSTATUS_OFF,	// Mask for all bus errors
} cantp_busstatus;

// Represents an general error (used in cantp_status).
//	note: maximum value that can be included in a cantp_status: 0xFF
typedef enum _cantp_errstatus {
	PCANTP_ERRSTATUS_OK = 0x00U,							// No error
	PCANTP_ERRSTATUS_NOT_INITIALIZED = 0x01U,				// Not Initialized
	PCANTP_ERRSTATUS_ALREADY_INITIALIZED = 0x02U,			// Already Initialized
	PCANTP_ERRSTATUS_NO_MEMORY = 0x03U,						// Could not obtain memory
	PCANTP_ERRSTATUS_OVERFLOW = 0x04U,						// Input buffer overflow
	PCANTP_ERRSTATUS_NO_MESSAGE = 0x07U,					// No Message available
	PCANTP_ERRSTATUS_PARAM_INVALID_TYPE = 0x08U,			// Parameter has an invalid or unexpected type
	PCANTP_ERRSTATUS_PARAM_INVALID_VALUE = 0x09U,			// Parameter has an invalid value
	PCANTP_ERRSTATUS_MAPPING_NOT_INITIALIZED = 0x0DU,		// PCANTP mapping not initialized
	PCANTP_ERRSTATUS_MAPPING_INVALID = 0x0EU,				// PCANTP mapping parameters are invalid
	PCANTP_ERRSTATUS_MAPPING_ALREADY_INITIALIZED = 0x0FU,	// PCANTP mapping already defined
	PCANTP_ERRSTATUS_PARAM_BUFFER_TOO_SMALL = 0x10U,
	PCANTP_ERRSTATUS_QUEUE_TX_FULL = 0x11U,					// Tx queue is full
	PCANTP_ERRSTATUS_LOCK_TIMEOUT = 0x12U,					// Failed to get an access to the internal lock
	PCANTP_ERRSTATUS_INVALID_HANDLE = 0x13U,				// Invalid cantp_handle
	PCANTP_ERRSTATUS_UNKNOWN = 0xFFU,						// unknown/generic error
} cantp_errstatus;

// Represents additional status information (used in cantp_status).
//	note: maximum value that can be included in a cantp_status: 0x3F
typedef enum _cantp_infostatus {
	PCANTP_INFOSTATUS_OK = 0x00,							// no extra information
	PCANTP_INFOSTATUS_CAUTION_INPUT_MODIFIED = 0x01,		// input was modified by the API
	PCANTP_INFOSTATUS_CAUTION_DLC_MODIFIED = 0x02,			// DLC value was modified by the API
	PCANTP_INFOSTATUS_CAUTION_DATA_LENGTH_MODIFIED = 0x04,	// Data Length value was modified by the API
	PCANTP_INFOSTATUS_CAUTION_FD_FLAG_MODIFIED = 0x08,		// FD related flags value were modified by the API
	PCANTP_INFOSTATUS_CAUTION_RX_QUEUE_FULL = 0x10,			// Message receive queue is full (oldest messages may be lost)
	PCANTP_INFOSTATUS_CAUTION_BUFFER_IN_USE = 0x20,			// Buffer is used by another thread or API
	PCANTP_INFOSTATUS_CAUTION_RX_QUEUE_OVERRUN = 0x30		// Internal queue read too late (a frame was lost).
} cantp_infostatus;

// Represents the PCAN error and status codes
typedef uint32_t cantp_pcanstatus;

// Defines constants used by the next enum: cantp_status
#define PCANTP_STATUS_OFFSET_BUS	8
#define PCANTP_STATUS_OFFSET_NET	(PCANTP_STATUS_OFFSET_BUS + 5)
#define PCANTP_STATUS_OFFSET_INFO	(PCANTP_STATUS_OFFSET_NET + 5)
// Represents the PCANTP error and status codes.
//
// Bits information:
//   32|  28|  24|  20|  16|  12|   8|   4|   0|
//     |    |    |    |    |    |    |    |    |
//      0000 0000 0000 0000 0000 0000 0000 0000
//     |    |    |    |    |         [0000 0000] => PCAN-ISO-TP API errors
//     |    |    |    |    |  [0 0000]           => CAN Bus status
//     |    |    |    | [00 000]                 => Networking message status
//     |    |    [0000 00]                       => API extra information
//     |[000 0000]                               => Reserved
//     [0]                                       => PCANBasic error flag (overrides the meaning of all bits)
typedef enum _cantp_status {
	PCANTP_STATUS_OK = PCANTP_ERRSTATUS_OK,
	PCANTP_STATUS_NOT_INITIALIZED = PCANTP_ERRSTATUS_NOT_INITIALIZED,
	PCANTP_STATUS_ALREADY_INITIALIZED = PCANTP_ERRSTATUS_ALREADY_INITIALIZED,
	PCANTP_STATUS_NO_MEMORY = PCANTP_ERRSTATUS_NO_MEMORY,
	PCANTP_STATUS_OVERFLOW = PCANTP_ERRSTATUS_OVERFLOW,
	PCANTP_STATUS_NO_MESSAGE = PCANTP_ERRSTATUS_NO_MESSAGE,
	PCANTP_STATUS_PARAM_INVALID_TYPE = PCANTP_ERRSTATUS_PARAM_INVALID_TYPE,
	PCANTP_STATUS_PARAM_INVALID_VALUE = PCANTP_ERRSTATUS_PARAM_INVALID_VALUE,
	PCANTP_STATUS_MAPPING_NOT_INITIALIZED = PCANTP_ERRSTATUS_MAPPING_NOT_INITIALIZED,
	PCANTP_STATUS_MAPPING_INVALID = PCANTP_ERRSTATUS_MAPPING_INVALID,
	PCANTP_STATUS_MAPPING_ALREADY_INITIALIZED = PCANTP_ERRSTATUS_MAPPING_ALREADY_INITIALIZED,
	PCANTP_STATUS_PARAM_BUFFER_TOO_SMALL = PCANTP_ERRSTATUS_PARAM_BUFFER_TOO_SMALL,
	PCANTP_STATUS_QUEUE_TX_FULL = PCANTP_ERRSTATUS_QUEUE_TX_FULL,
	PCANTP_STATUS_LOCK_TIMEOUT = PCANTP_ERRSTATUS_LOCK_TIMEOUT,
	PCANTP_STATUS_HANDLE_INVALID = PCANTP_ERRSTATUS_INVALID_HANDLE,
	PCANTP_STATUS_UNKNOWN = PCANTP_ERRSTATUS_UNKNOWN,
	// Bus status flags (bits [8..11])
	PCANTP_STATUS_FLAG_BUS_LIGHT = (PCANTP_BUSSTATUS_LIGHT << PCANTP_STATUS_OFFSET_BUS),		// PCANTP Channel is in BUS-LIGHT error state
	PCANTP_STATUS_FLAG_BUS_HEAVY = (PCANTP_BUSSTATUS_HEAVY << PCANTP_STATUS_OFFSET_BUS),		// PCANTP Channel is in BUS-HEAVY error state
	PCANTP_STATUS_FLAG_BUS_WARNING = PCANTP_STATUS_FLAG_BUS_HEAVY,								// PCANTP Channel is in BUS-HEAVY error state
	PCANTP_STATUS_FLAG_BUS_PASSIVE = (PCANTP_BUSSTATUS_PASSIVE << PCANTP_STATUS_OFFSET_BUS),	// PCANTP Channel is error passive state
	PCANTP_STATUS_FLAG_BUS_OFF = (PCANTP_BUSSTATUS_OFF << PCANTP_STATUS_OFFSET_BUS),			// PCANTP Channel is in BUS-OFF error state
	PCANTP_STATUS_FLAG_BUS_ANY = (PCANTP_BUSSTATUS_ANY << PCANTP_STATUS_OFFSET_BUS),
	// Network status (bits [13..17])
	PCANTP_STATUS_FLAG_NETWORK_RESULT = (1 << PCANTP_STATUS_OFFSET_NET),	// This flag states if one of the following network errors occured with the fetched message
	PCANTP_STATUS_NETWORK_TIMEOUT_A = (PCANTP_STATUS_FLAG_NETWORK_RESULT | (PCANTP_NETSTATUS_TIMEOUT_A << (PCANTP_STATUS_OFFSET_NET + 1))),		// timeout occured between 2 frames transmission (sender and receiver side)
	PCANTP_STATUS_NETWORK_TIMEOUT_Bs = (PCANTP_STATUS_FLAG_NETWORK_RESULT | (PCANTP_NETSTATUS_TIMEOUT_Bs << (PCANTP_STATUS_OFFSET_NET + 1))),		// sender side timeout while waiting for flow control frame
	PCANTP_STATUS_NETWORK_TIMEOUT_Cr = (PCANTP_STATUS_FLAG_NETWORK_RESULT | (PCANTP_NETSTATUS_TIMEOUT_Cr << (PCANTP_STATUS_OFFSET_NET + 1))),		// receiver side timeout while waiting for consecutive frame
	PCANTP_STATUS_NETWORK_WRONG_SN = (PCANTP_STATUS_FLAG_NETWORK_RESULT | (PCANTP_NETSTATUS_WRONG_SN << (PCANTP_STATUS_OFFSET_NET + 1))),			// unexpected sequence number
	PCANTP_STATUS_NETWORK_INVALID_FS = (PCANTP_STATUS_FLAG_NETWORK_RESULT | (PCANTP_NETSTATUS_INVALID_FS << (PCANTP_STATUS_OFFSET_NET + 1))),		// invalid or unknown FlowStatus
	PCANTP_STATUS_NETWORK_UNEXP_PDU = (PCANTP_STATUS_FLAG_NETWORK_RESULT | (PCANTP_NETSTATUS_UNEXP_PDU << (PCANTP_STATUS_OFFSET_NET + 1))),		// unexpected protocol data unit
	PCANTP_STATUS_NETWORK_WFT_OVRN = (PCANTP_STATUS_FLAG_NETWORK_RESULT | (PCANTP_NETSTATUS_WFT_OVRN << (PCANTP_STATUS_OFFSET_NET + 1))),			// reception of flow control WAIT frame that exceeds the maximum counter defined by PCANTP_PARAMETER_WFT_MAX
	PCANTP_STATUS_NETWORK_BUFFER_OVFLW = (PCANTP_STATUS_FLAG_NETWORK_RESULT | (PCANTP_NETSTATUS_BUFFER_OVFLW << (PCANTP_STATUS_OFFSET_NET + 1))),	// buffer on the receiver side cannot store the data length (server side only)
	PCANTP_STATUS_NETWORK_ERROR = (PCANTP_STATUS_FLAG_NETWORK_RESULT | (PCANTP_NETSTATUS_ERROR << (PCANTP_STATUS_OFFSET_NET + 1))),				// general error
	PCANTP_STATUS_NETWORK_IGNORED = (PCANTP_STATUS_FLAG_NETWORK_RESULT | (PCANTP_NETSTATUS_IGNORED << (PCANTP_STATUS_OFFSET_NET + 1))),			// message was invalid and ignored
	PCANTP_STATUS_NETWORK_TIMEOUT_Ar = (PCANTP_STATUS_FLAG_NETWORK_RESULT | (PCANTP_NETSTATUS_TIMEOUT_Ar << (PCANTP_STATUS_OFFSET_NET + 1))),		// receiver side timeout while transmitting
	PCANTP_STATUS_NETWORK_TIMEOUT_As = (PCANTP_STATUS_FLAG_NETWORK_RESULT | (PCANTP_NETSTATUS_TIMEOUT_As << (PCANTP_STATUS_OFFSET_NET + 1))),		// sender side timeout while transmitting
	// ISO-TP extra information flags
	PCANTP_STATUS_CAUTION_INPUT_MODIFIED = (PCANTP_INFOSTATUS_CAUTION_INPUT_MODIFIED << PCANTP_STATUS_OFFSET_INFO),				// input was modified
	PCANTP_STATUS_CAUTION_DLC_MODIFIED = (PCANTP_INFOSTATUS_CAUTION_DLC_MODIFIED << PCANTP_STATUS_OFFSET_INFO),					// DLC value of the input was modified
	PCANTP_STATUS_CAUTION_DATA_LENGTH_MODIFIED = (PCANTP_INFOSTATUS_CAUTION_DATA_LENGTH_MODIFIED << PCANTP_STATUS_OFFSET_INFO),	// Data Length value of the input was modified
	PCANTP_STATUS_CAUTION_FD_FLAG_MODIFIED = (PCANTP_INFOSTATUS_CAUTION_FD_FLAG_MODIFIED << PCANTP_STATUS_OFFSET_INFO),			// FD flags of the input was modified
	PCANTP_STATUS_CAUTION_RX_QUEUE_FULL = (PCANTP_INFOSTATUS_CAUTION_RX_QUEUE_FULL << PCANTP_STATUS_OFFSET_INFO),				// Receive queue is full
	PCANTP_STATUS_CAUTION_BUFFER_IN_USE = (PCANTP_INFOSTATUS_CAUTION_BUFFER_IN_USE << PCANTP_STATUS_OFFSET_INFO),				// Buffer is used by another thread or API
	PCANTP_STATUS_CAUTION_RX_QUEUE_OVERRUN = (PCANTP_INFOSTATUS_CAUTION_RX_QUEUE_OVERRUN << PCANTP_STATUS_OFFSET_INFO),			// Internal queue read too late (a frame was lost).
	// Lower API status code: see also PCANTP_STATUS_xx macros
	PCANTP_STATUS_FLAG_PCAN_STATUS = 0x80000000U,	// PCAN error flag, remove flag to get a usable PCAN error/status code (cf. PCANBasic API)
	// Masks to merge/retrieve different PCANTP status by type in a cantp_status
	PCANTP_STATUS_MASK_ERROR = 0x000000FFU,		// filter by PCANTP_STATUSTYPE_ERR type
	PCANTP_STATUS_MASK_BUS = 0x00001F00U,		// filter by PCANTP_STATUSTYPE_BUS type
	PCANTP_STATUS_MASK_ISOTP_NET = 0x0003E000U,	// filter by PCANTP_STATUSTYPE_NET type
	PCANTP_STATUS_MASK_INFO = 0x00FC0000U,		// filter by PCANTP_STATUSTYPE_INFO type
	PCANTP_STATUS_MASK_PCAN = ~PCANTP_STATUS_FLAG_PCAN_STATUS,		// filter by PCANTP_STATUSTYPE_PCAN type
} cantp_status;

// List of parameters handled by PCAN-ISO-TP (rev. 2016)
//	Note: PCAN-Basic parameters (PCAN_PARAM_xxx) are compatible via casting.
typedef enum _cantp_parameter {
	PCANTP_PARAMETER_API_VERSION = 0x101,		// PCAN-ISO-TP API version parameter
	PCANTP_PARAMETER_CHANNEL_CONDITION = 0x102,	// 1 BYTE data describing the condition of a channel.
	PCANTP_PARAMETER_DEBUG = 0x103,				// 1 BYTE data describing the debug mode
	PCANTP_PARAMETER_RECEIVE_EVENT = 0x104,		// data is pointer to a HANDLE created by CreateEvent function

	PCANTP_PARAMETER_FRAME_FILTERING = 0x105,	// 1 BYTE data stating if unsegmented (NON-ISO-TP) CAN frames can be received
	PCANTP_PARAMETER_CAN_TX_DL = 0x106,			// 1 BYTE data stating the default DLC to use when transmitting messages with CAN FD
	PCANTP_PARAMETER_CAN_DATA_PADDING = 0x107,	// 1 BYTE data stating if CAN frame DLC uses padding or not
	PCANTP_PARAMETER_CAN_PADDING_VALUE = 0x108,	// 1 BYTE data stating the value used for CAN data padding
	PCANTP_PARAMETER_ISO_REV = 0x109,			// 1 BYTE data stating which revision of ISO 15765-2 to use (see PCANTP_ISO_REV_*).
	PCANTP_PARAMETER_J1939_PRIORITY = 0x10A,	// 1 BYTE data stating the default priority value for normal fixed, mixed and enhanced addressing (default=6)
	PCANTP_PARAMETER_MSG_PENDING = 0x10B,		// 1 BYTE data stating if pending messages are displayed/hidden

	PCANTP_PARAMETER_BLOCK_SIZE = 0x10C,		// 1 BYTE data describing the block size parameter (BS)
	PCANTP_PARAMETER_BLOCK_SIZE_TX = 0x10D,		// 2 BYTE data describing the transmit block size parameter (BS_TX)
	PCANTP_PARAMETER_SEPARATION_TIME = 0x10E,	// 1 BYTE data describing the seperation time parameter (STmin)
	PCANTP_PARAMETER_SEPARATION_TIME_TX = 0x10F,// 2 BYTE data describing the transmit seperation time parameter (STmin_TX)
	PCANTP_PARAMETER_WFT_MAX = 0x123,			// 4 BYTE data describing the Wait Frame Transmissions parameter (maximum number of WFT FC frame a receiver can send).
	PCANTP_PARAMETER_WFT_MAX_TX = 0x110,		// 4 BYTE data describing the transmit Wait Frame Transmissions parameter (WFT_TX as maximum number of WFT FC frame a transmitter can receive).

	PCANTP_PARAMETER_TIMEOUT_AS = 0x111,		// 4 BYTE data describing ISO-15765-2:Timeout As.
	PCANTP_PARAMETER_TIMEOUT_AR = 0x112,		// 4 BYTE data describing ISO-15765-2:Timeout Ar.
	PCANTP_PARAMETER_TIMEOUT_BR = 0x121,		// 4 BYTE data describing ISO-15765-2:Timeout Br.
	PCANTP_PARAMETER_TIMEOUT_BS = 0x113,		// 4 BYTE data describing ISO-15765-2:Timeout Bs.
	PCANTP_PARAMETER_TIMEOUT_CR = 0x114,		// 4 BYTE data describing ISO-15765-2:Timeout Cr.
	PCANTP_PARAMETER_TIMEOUT_CS = 0x122,		// 4 BYTE data describing ISO-15765-2:Timeout Cs.
	PCANTP_PARAMETER_TIMEOUT_TOLERANCE = 0x115,	// 1 BYTE data describing the tolerence to apply to all timeout as a percentage ([0..100].
	PCANTP_PARAMETER_ISO_TIMEOUTS = 0x116,		// 1 BYTE data to set predefined ISO values for timeouts (see PCANTP_ISO_TIMEOUTS_*).

	PCANTP_PARAMETER_SELFRECEIVE_LATENCY = 0x117,		// 1 BYTE data to set optimization options to improve delay between ISO-TP consecutive frames.
	PCANTP_PARAMETER_MAX_RX_QUEUE = 0x118,				// 2 BYTE data describing the maximum number of messages in the Rx queue.
	PCANTP_PARAMETER_KEEP_HIGHER_LAYER_MESSAGES = 0x119,// 1 BYTE data stating if messages handled by higher layer APIs are still available in this API (default=0).
	PCANTP_PARAMETER_FILTER_CAN_ID = 0x11A,				// 1 BYTE data stating if the white-list CAN IDs filtering mechanism is enabled.
	PCANTP_PARAMETER_SUPPORT_29B_ENHANCED = 0x11B,		// 1 BYTE data stating if the 29 bit Enhanced Diagnostic CAN identifier is supported (ISO-15765-3:2004, default is false with ISO revision 2016).
	PCANTP_PARAMETER_SUPPORT_29B_FIXED_NORMAL = 0x11C,	// 1 BYTE data stating if the 29 bit Fixed Normal addressing CAN identifier is supported (default is true).
	PCANTP_PARAMETER_SUPPORT_29B_MIXED = 0x11D,			// 1 BYTE data stating if the 29 bit Mixed addressing CAN identifier is supported (default is true).
	PCANTP_PARAMETER_MSG_CHECK = 0x11E,					// Pointer to a cantp_msg, checks if the message is valid and can be sent (ex. if a mapping is needed) and corrects input if needed.
	PCANTP_PARAMETER_RESET_HARD = 0x11F,				// 1 BYTE data stating to clear Rx/Tx queues and CAN controller (channel is unitialized and re-initialized but settings and mappings are kept)
	PCANTP_PARAMETER_NETWORK_LAYER_DESIGN = 0x120,		// 1 BYTE data stating if network is full-duplex (default) or half-duplex
	//PCANTP_PARAMETER_TIMEOUT_BR = 0x121,		// 4 BYTE data describing ISO-15765-2:Timeout Br.
	//PCANTP_PARAMETER_TIMEOUT_CS = 0x122,		// 4 BYTE data describing ISO-15765-2:Timeout Cs.
	//PCANTP_PARAMETER_WFT_MAX = 0x123,			// 4 BYTE data describing the Wait Frame Transmissions parameter (maximum number of WFT FC frame a receiver can send).
	PCANTP_PARAMETER_ALLOW_MSGTYPE_CANINFO = 0x124,		// 1 BYTE data stating if API allows receiption PCANTP_MSGTYPE_CANINFO from lower layer APIs
	PCANTP_PARAMETER_RECEIVE_EVENT_CALLBACK = 0x125,	// Data is a pointer to a user-defined callback triggered when a message is received.
	PCANTP_PARAMETER_RECEIVE_EVENT_CALLBACK_USER_CONTEXT = 0x126,	// Data is a pointer to a user-defined structure. It can be used to pass user arguments to the reception callback function.

	PCANTP_PARAMETER_HARDWARE_NAME = PCAN_HARDWARE_NAME,		// PCAN hardware name parameter
	PCANTP_PARAMETER_DEVICE_ID = PCAN_DEVICE_ID,				// PCAN-USB device identifier parameter
	PCANTP_PARAMETER_DEVICE_NUMBER = PCAN_DEVICE_ID,			// deprecated use PCANTP_PARAMETER_DEVICE_ID instead
	PCANTP_PARAMETER_CONTROLLER_NUMBER = PCAN_CONTROLLER_NUMBER,// CAN-Controller number of a PCAN-Channel
	PCANTP_PARAMETER_CHANNEL_FEATURES = PCAN_CHANNEL_FEATURES	// Capabilities of a PCAN device (FEATURE_***)
} cantp_parameter;

// Represents the type of a CANTP message (see field "cantp_msg.type").
typedef enum _cantp_msgtype {
	PCANTP_MSGTYPE_NONE = 0x00,		// uninitialized message (data is NULL)
	PCANTP_MSGTYPE_CAN = 0x01,		// standard CAN frame
	PCANTP_MSGTYPE_CANFD = 0x02,	// CAN frame with FD support
	PCANTP_MSGTYPE_ISOTP = 0x04,	// ISO-TP message (ISO:15765)
	PCANTP_MSGTYPE_CANINFO = 0x08,	// CAN bus information

	PCANTP_MSGTYPE_FRAME = PCANTP_MSGTYPE_CAN | PCANTP_MSGTYPE_CANFD,				// frame only: unsegmented messages
	PCANTP_MSGTYPE_ANY = PCANTP_MSGTYPE_FRAME | PCANTP_MSGTYPE_ISOTP | 0xFFFFFFFF	// any supported message type
} cantp_msgtype;

// Represents the flags common to all types of cantp_msg (see field "cantp_msg.msgdata.flags").
typedef enum _cantp_msgflag {
	PCANTP_MSGFLAG_NONE = 0,		// no flag
	PCANTP_MSGFLAG_LOOPBACK = 1,	// message is the confirmation of a transmitted message
	PCANTP_MSGFLAG_ISOTP_FRAME = 2,	// message is a frame of a segmented ISO-TP message
	PCANTP_MSGFLAG_QOVERRUN_OCCURED = 4,	// a QOVERRUN error occured while processing this message (confirmation via echo message is not confirmed)
} cantp_msgflag;

// Represents the flags of a CAN or CAN FD frame (must be used as flags for ex. EXTENDED|FD|BRS.) (see field "cantp_msg.can_info.can_msgtype")
typedef enum _cantp_can_msgtype {
	PCANTP_CAN_MSGTYPE_STANDARD = PCAN_MESSAGE_STANDARD,	// The PCAN message is a CAN Standard Frame (11-bit identifier)
	PCANTP_CAN_MSGTYPE_RTR = PCAN_MESSAGE_RTR,				// The PCAN message is a CAN Remote-Transfer-Request Frame
	PCANTP_CAN_MSGTYPE_EXTENDED = PCAN_MESSAGE_EXTENDED,	// The PCAN message is a CAN Extended Frame (29-bit identifier)
	PCANTP_CAN_MSGTYPE_FD = PCAN_MESSAGE_FD,				// The PCAN message represents a FD frame in terms of CiA Specs
	PCANTP_CAN_MSGTYPE_BRS = PCAN_MESSAGE_BRS,				// The PCAN message represents a FD bit rate switch (CAN data at a higher bit rate)
	PCANTP_CAN_MSGTYPE_ESI = PCAN_MESSAGE_ESI,				// The PCAN message represents a FD error state indicator(CAN FD transmitter was error active)
	PCANTP_CAN_MSGTYPE_ERRFRAME = PCAN_MESSAGE_ERRFRAME,	// The PCAN message represents an error frame.
	PCANTP_CAN_MSGTYPE_STATUS = PCAN_MESSAGE_STATUS,		// The PCAN message represents a PCAN status message.
	PCANTP_CAN_MSGTYPE_ECHO = PCAN_MESSAGE_ECHO,			// Echo messages reception status within a PCAN-Channel
	PCANTP_CAN_MSGTYPE_SELFRECEIVE = PCAN_MESSAGE_ECHO,		// deprecated: use PCANTP_CAN_MSGTYPE_ECHO
	PCANTP_CAN_MSGTYPE_FLAG_INFO = (PCAN_MESSAGE_ERRFRAME | PCAN_MESSAGE_STATUS)	// Flag stating that the message is not a CAN Frame
} cantp_can_msgtype;

// Represents the type of an ISO-TP message (see field "cantp_msg.msgdata.isotp.netaddrinfo.msgtype").
typedef enum _cantp_isotp_msgtype {
	PCANTP_ISOTP_MSGTYPE_UNKNOWN = 0x00,					// Unknown (non-ISO-TP) message
	PCANTP_ISOTP_MSGTYPE_DIAGNOSTIC = 0x01,					// Diagnostic message (request or confirmation)
	PCANTP_ISOTP_MSGTYPE_REMOTE_DIAGNOSTIC = 0x02,			// Remote Diagnostic message (request or confirmation)
	PCANTP_ISOTP_MSGTYPE_FLAG_INDICATION_RX = 0x10,			// Multi-Frame Message is being received
	PCANTP_ISOTP_MSGTYPE_FLAG_INDICATION_TX = 0x20,			// Multi-Frame Message is being transmitted
	PCANTP_ISOTP_MSGTYPE_FLAG_INDICATION = (0x10 | 0x20),	// Multi-Frame Message is being communicated (Tx or Rx)
	PCANTP_ISOTP_MSGTYPE_MASK_INDICATION = 0x0F				// Mask to remove Indication flags
} cantp_isotp_msgtype;

// Represents the addressing format of an ISO-TP message (see field "cantp_msg.msgdata.isotp.netaddrinfo.format").
typedef enum _cantp_isotp_format {
	PCANTP_ISOTP_FORMAT_UNKNOWN = 0xFF,			// unknown adressing format
	PCANTP_ISOTP_FORMAT_NONE = 0x00,			// unsegmented CAN frame
	PCANTP_ISOTP_FORMAT_NORMAL = 0x01,			// normal adressing format from ISO 15765-2
	PCANTP_ISOTP_FORMAT_FIXED_NORMAL = 0x02,	// fixed normal adressing format from ISO 15765-2
	PCANTP_ISOTP_FORMAT_EXTENDED = 0x03,		// extended adressing format from ISO 15765-2
	PCANTP_ISOTP_FORMAT_MIXED = 0x04,			// mixed adressing format from ISO 15765-2
	PCANTP_ISOTP_FORMAT_ENHANCED = 0x05,		// enhanced adressing format from ISO 15765-3
} cantp_isotp_format;

// Represents the type of target of an ISO-TP message (see field "cantp_msg.msgdata.isotp.netaddrinfo.target_type").
typedef enum _cantp_isotp_addressing {
	PCANTP_ISOTP_ADDRESSING_UNKNOWN = 0x00,		// Unknown adressing format
	PCANTP_ISOTP_ADDRESSING_PHYSICAL = 0x01,	// Physical addressing ("peer to peer")
	PCANTP_ISOTP_ADDRESSING_FUNCTIONAL = 0x02,	// Functional addressing ("peer to any")
} cantp_isotp_addressing;

// Represents the options of a message (mainly supported for ISO-TP message) (see field "cantp_msg.msgdata.options").
typedef enum _cantp_option {
	PCANTP_OPTION_DEBUG = PCANTP_PARAMETER_DEBUG,								// 1 BYTE data describing the debug mode
	PCANTP_OPTION_CAN_DATA_PADDING = PCANTP_PARAMETER_CAN_DATA_PADDING,			// 1 BYTE data stating if CAN frame DLC uses padding or not
	PCANTP_OPTION_CAN_PADDING_VALUE = PCANTP_PARAMETER_CAN_PADDING_VALUE,		// 1 BYTE data stating the value used for CAN data padding
	PCANTP_OPTION_J1939_PRIORITY = PCANTP_PARAMETER_J1939_PRIORITY,				// 1 BYTE data stating the default priority value for normal fixed, mixed and enhanced addressing (default=6)
	PCANTP_OPTION_MSG_PENDING = PCANTP_PARAMETER_MSG_PENDING,					// 1 BYTE data stating if pending messages are displayed/hidden
	PCANTP_OPTION_BLOCK_SIZE = PCANTP_PARAMETER_BLOCK_SIZE,						// 1 BYTE data describing the block size parameter (BS)
	PCANTP_OPTION_BLOCK_SIZE_TX = PCANTP_PARAMETER_BLOCK_SIZE_TX,				// 2 BYTE data describing the transmit block size parameter (BS_TX)
	PCANTP_OPTION_SEPARATION_TIME = PCANTP_PARAMETER_SEPARATION_TIME,			// 1 BYTE data describing the seperation time parameter (STmin)
	PCANTP_OPTION_SEPARATION_TIME_TX = PCANTP_PARAMETER_SEPARATION_TIME_TX,		// 2 BYTE data describing the transmit seperation time parameter (STmin_TX)
	PCANTP_OPTION_WFT_MAX = PCANTP_PARAMETER_WFT_MAX,							// 4 BYTE data describing the Wait Frame Transmissions parameter. 
	PCANTP_OPTION_WFT_MAX_TX = PCANTP_PARAMETER_WFT_MAX_TX,						// 4 BYTE data describing the transmite Wait Frame Transmissions parameter (WFT_TX). 
	PCANTP_OPTION_TIMEOUT_AS = PCANTP_PARAMETER_TIMEOUT_AS,						// 4 BYTE data describing ISO-15765-2:Timeout As.
	PCANTP_OPTION_TIMEOUT_AR = PCANTP_PARAMETER_TIMEOUT_AR,						// 4 BYTE data describing ISO-15765-2:Timeout Ar.
	PCANTP_OPTION_TIMEOUT_BS = PCANTP_PARAMETER_TIMEOUT_BS,						// 4 BYTE data describing ISO-15765-2:Timeout Bs.
	PCANTP_OPTION_TIMEOUT_BR = PCANTP_PARAMETER_TIMEOUT_BR,						// 4 BYTE data describing ISO-15765-2:Timeout Br.
	PCANTP_OPTION_TIMEOUT_CS = PCANTP_PARAMETER_TIMEOUT_CS,						// 4 BYTE data describing ISO-15765-2:Timeout Cs.
	PCANTP_OPTION_TIMEOUT_CR = PCANTP_PARAMETER_TIMEOUT_CR,						// 4 BYTE data describing ISO-15765-2:Timeout Cr.
	PCANTP_OPTION_SELFRECEIVE_LATENCY = PCANTP_PARAMETER_SELFRECEIVE_LATENCY	// 1 BYTE data to set optimization options to improve delay between ISO-TP consecutive frames.
} cantp_option;

// Represents the status for a message whose transmission is in progress.
typedef enum _cantp_msgprogress_state {
	PCANTP_MSGPROGRESS_STATE_QUEUED = 0,		// Message is not yet handled.
	PCANTP_MSGPROGRESS_STATE_PROCESSING = 1,	// Message is being processed (received or transmitted).
	PCANTP_MSGPROGRESS_STATE_COMPLETED = 2,		// Message is completed.
	PCANTP_MSGPROGRESS_STATE_UNKNOWN = 3		// Message is unknown/not found.
} cantp_msgprogress_state;

// Represents the direction of a message's communication.
typedef enum _cantp_msgdirection {
	PCANTP_MSGDIRECTION_RX = 0,		// Message is being received.
	PCANTP_MSGDIRECTION_TX = 1,		// Message is being transmitted.
} cantp_msgdirection;

// Reserved extra information
#ifndef cantp_msginfo_flag
#define cantp_msginfo_flag uint32_t
#endif
#ifndef cantp_msginfo_extra
#define cantp_msginfo_extra void*
#endif
#ifndef cantp_isotp_info
#define cantp_isotp_info void*
#endif

////////////////////////////////////////////////////////////
// Types definition
////////////////////////////////////////////////////////////


#define cantp_bitrate	char*		// Represents a PCAN-FD bit rate string
#define cantp_timestamp uint64_t	// Timestamp

// prevent "macro redefinition" warnings
#undef PCANTP_DEBUG_NONE
#undef PCANTP_DEBUG_CAN
#undef PCANTP_MSG_PENDING_HIDE
#undef PCANTP_MSG_PENDING_SHOW
#undef PCANTP_CAN_DATA_PADDING_NONE
#undef PCANTP_CAN_DATA_PADDING_ON
// PCANTP parameter values
#define PCANTP_VALUE_PARAMETER_OFF				PCAN_PARAMETER_OFF
#define PCANTP_VALUE_PARAMETER_ON				PCAN_PARAMETER_ON
#define PCANTP_DEBUG_NONE						PCANTP_VALUE_PARAMETER_OFF		// No debug messages
#define PCANTP_DEBUG_CAN						PCANTP_VALUE_PARAMETER_ON		// Enable debug messages
#define PCANTP_DEBUG_NOTICE						0xF4		// Enable debug messages (only notices, informations, warnings, errors)
#define PCANTP_DEBUG_INFO						0xF3		// Enable debug messages (only informations, warnings, errors)
#define PCANTP_DEBUG_WARNING					0xF2		// Enable debug messages (only warnings, errors)
#define PCANTP_DEBUG_ERROR						0xF1		// Enable debug messages (only errors)
#define PCANTP_CHANNEL_UNAVAILABLE				0x00		// The Channel is illegal or not available
#define PCANTP_CHANNEL_AVAILABLE				0x01		// The Channel is available
#define PCANTP_CHANNEL_OCCUPIED					0x02		// The Channel is valid, and is being used
#define PCANTP_WFT_MAX_UNLIMITED				0x00		// if set Flow Control frame shall not use the WT flow status value
#define PCANTP_WFT_MAX_DEFAULT					0x10		// an integer describing the Wait Frame Transmissions parameter.
#define PCANTP_WFT_MAX_TX_DEFAULT				PCANTP_WFT_MAX_UNLIMITED		// an integer describing the transmit Wait Frame Transmissions parameter.
#define PCANTP_MSG_PENDING_HIDE					PCANTP_VALUE_PARAMETER_OFF		// hide messages with type PCANTP_MESSAGE_INDICATION from CANTP_Read function
#define PCANTP_MSG_PENDING_SHOW					PCANTP_VALUE_PARAMETER_ON		// show messages with type PCANTP_MESSAGE_INDICATION from CANTP_Read function
#define PCANTP_CAN_DATA_PADDING_NONE			PCANTP_VALUE_PARAMETER_OFF		// uses CAN frame data optimization
#define PCANTP_CAN_DATA_PADDING_ON				PCANTP_VALUE_PARAMETER_ON		// uses CAN frame data padding (default, i.e. CAN DLC = 8)
#define PCANTP_CAN_DATA_PADDING_VALUE			0x55		// default value used if CAN data padding is enabled
#define PCANTP_FRAME_FILTERING_ISOTP			0x00		// disable reception of unformatted (NON-ISO-TP) CAN frames (default)
															//	only ISO 15765 messages will be received
#define PCANTP_FRAME_FILTERING_CAN				0x01		// enable reception of unformatted (NON-ISO-TP) CAN frames
															//	received messages will be treated as either ISO 15765 or as an unformatted CAN frame
#define PCANTP_FRAME_FILTERING_VERBOSE			0x02		// enable reception of unformatted (NON-ISO-TP) CAN frames
															//	received messages will be treated as ISO 15765, unformatted CAN frame, or both (user will able to read fragmented CAN frames)
#define PCANTP_J1939_PRIORITY_DEFAULT			0x06		// default priority for ISO-TP messages (only available fot normal fixed, mixed and enhanced addressing)
#define PCANTP_MAX_CAN_ID_11_BIT				0x7FF		// Highest 11 bit (standard) CAN ID
#define PCANTP_MAX_CAN_ID_29_BIT				0x1FFFFFFF	// Hignest 29 bit (extended) CAN ID
#define PCANTP_MAX_LENGTH_CAN_STANDARD			0x08		// maximum length of a CAN (non-FD) frame (8)
#define PCANTP_MAX_LENGTH_CAN_FD				0x40		// maximum length of a CAN FD frame (64)
#define PCANTP_MAX_LENGTH_ISOTP2004				0xFFF		// maximum length of an ISO-TP rev. 2004 frame (4095)
#define PCANTP_MAX_LENGTH_ISOTP2016				0xFFFFFFFF	// maximum length of an ISO-TP rev. 2016 frame (4294967295)
#define PCANTP_MAX_LENGTH_ALLOC					0xFFFFFFU	// maximum length before using virtual allocation for ISO-TP messages
#define PCANTP_CAN_TX_DL_DEFAULT				PCANTP_MAX_LENGTH_CAN_STANDARD	 // default DLC for fragmented frames when transmiting ISO-TP messages
#define PCANTP_ISO_REV_2004						0x01		// ISO-15765-2:2004(E)
#define PCANTP_ISO_REV_2016						0x02		// ISO-15765-2:2016(E)
#define PCANTP_BLOCK_SIZE_TX_IGNORE				0xFFFF		// disables the feature "ignore received BlockSize value"
#define PCANTP_SEPERATION_TIME_TX_IGNORE		0xFFFF		// disables the feature "ignore received STMin value"
#define PCANTP_ISO_TIMEOUTS_15765_2				0			// sets timeouts according to ISO-15765-2
#define PCANTP_ISO_TIMEOUTS_15765_4				1			// sets timeouts according to ISO-15765-4 (OBDII)
#define PCANTP_SELFRECEIVE_LATENCY_NONE			0			// no optimization (use this parameter if ECU requires strict respect of Minimum Separation Time)
#define PCANTP_SELFRECEIVE_LATENCY_LIGHT		1			// (DEFAULT) fragmented self-receive frame mechanism is ignored when STmin is set to 0xF3 and lower (<300µs)
#define PCANTP_SELFRECEIVE_LATENCY_OPTIMIZED	2			// as LIGHT value plus optimize self-receive latency by predicting the time to effectively write frames on bus
#define PCANTP_MAX_RX_QUEUE_DEFAULT				32767		// (DEFAULT) maxinum number of items in the receive queue
#define PCANTP_NETWORK_LAYER_FULL_DUPLEX		0			// (DEFAULT) Network layer design is full-duplex
#define PCANTP_NETWORK_LAYER_HALF_DUPLEX		1			// Network layer design is half-duplex (only one transmission/reception of the same NAI at a time)
// Standard ISO-15765-2 values
#define PCANTP_STMIN_ISO_15765_2				10			// Default value for Separation time
#define PCANTP_BS_ISO_15765_2					10			// Default value for BlockSize
#define PCANTP_TIMEOUT_AR_ISO_15765_2			(1000*1000)	// Default value for Timeout Ar in µs
#define PCANTP_TIMEOUT_AS_ISO_15765_2			(1000*1000)	// Default value for Timeout As in µs
#define PCANTP_TIMEOUT_BR_ISO_15765_2			(1000*1000)	// Default value for Timeout Br in µs
#define PCANTP_TIMEOUT_BS_ISO_15765_2			(1000*1000)	// Default value for Timeout Bs in µs
#define PCANTP_TIMEOUT_CR_ISO_15765_2			(1000*1000)	// Default value for Timeout Cr in µs
#define PCANTP_TIMEOUT_CS_ISO_15765_2			(1000*1000)	// Default value for Timeout Cs in µs
#define PCANTP_TIMEOUT_TOLERANCE				0			// Default value for timeout tolerance [0..100] (timeout = t * (1 + tolerance/100))
// Standard ISO-15765-4 (OBDII) values
#define PCANTP_STMIN_ISO_15765_4				0			// OBDII value for Separation time
#define PCANTP_BS_ISO_15765_4					0			// OBDII value for BlockSize
#define PCANTP_TIMEOUT_AR_ISO_15765_4			(1000*33)	// OBDII value for Timeout Ar in µs
#define PCANTP_TIMEOUT_AS_ISO_15765_4			(1000*33)	// OBDII value for Timeout As in µs
#define PCANTP_TIMEOUT_BR_ISO_15765_4			(1000*75)	// OBDII value for Timeout Br in µs
#define PCANTP_TIMEOUT_BS_ISO_15765_4			(1000*75)	// OBDII value for Timeout Bs in µs
#define PCANTP_TIMEOUT_CR_ISO_15765_4			(1000*150)	// OBDII value for Timeout Cr in µs
#define PCANTP_TIMEOUT_CS_ISO_15765_4			(1000*17)	// OBDII value for Timeout Cs in µs (Cs+As < 50ms)

// Values for cfg_value
#define PCANTP_FLAG_MASK_PRIORITY	0x07	// Mask for the 29bits ISOTP priority value (stored in bits [0..2])
#define PCANTP_FLAG_PADDING_ON		0x08	// Padding is enabled
#define PCANTP_FLAG_INDICATION_ON	0x10	// Message's indication is enabled
#define PCANTP_FLAG_ECHO_FRAMES_ON	0x20	// Echo of fragmented frames is enabled

////////////////////////////////////////////////////////////
// Constants definition
////////////////////////////////////////////////////////////

#define PCANTP_MAPPING_FLOW_CTRL_NONE	UINT32_MAX		// Mapping does not require a Flow Control frame.


////////////////////////////////////////////////////////////
// miscellaneous message related definitions
////////////////////////////////////////////////////////////

#pragma pack(push, 8)

// Internal information about cantp_msg message (reserved).
typedef struct _cantp_msginfo {
	uint32_t size;				// (read-only) size of the message object
	cantp_msginfo_flag flags;	// (read-only) reserved
	cantp_msginfo_extra extra;	// (read-only) reserved
} cantp_msginfo;

//	Represents message's options to override.
typedef struct _cantp_msgoption {
	cantp_option name;	// Name of the option.
	uint32_t value;		// Value of the option.
} cantp_msgoption;

//	Represents a list of message's options to override.
typedef struct _cantp_msgoption_list {
	cantp_msgoption* buffer;	// Pointer to an array of cantp_msgoption.
	uint32_t count;				// Number of options in the array.
} cantp_msgoption_list;

//	Represents common CAN information.
typedef struct _cantp_can_info {
	uint32_t can_id;				// CAN identifier
	cantp_can_msgtype can_msgtype;	// Types and flags of the CAN/CAN-FD frame (see cantp_can_msgtype)
	uint8_t	dlc;					// Data Length Code of the frame (0..15)
} cantp_can_info;

// Represents the network address information of an ISO-TP message.
typedef struct _cantp_netaddrinfo {
	cantp_isotp_msgtype msgtype;		// ISO-TP message type
	cantp_isotp_format format;			// ISO-TP format addressing
	cantp_isotp_addressing target_type;	// ISO-TP addressing/target type
	uint16_t source_addr;				// source address
	uint16_t target_addr;				// target address
	uint8_t extension_addr;				// extension address
} cantp_netaddrinfo;

// Represents a mapping between an ISO-TP network address information and a CAN ID.
typedef struct _cantp_mapping {
	uintptr_t uid;					// Mapping's unique ID (read-only, set by CANTP_AddMapping_2016)
	uint32_t can_id;				// CAN ID mapped to the Network Address Information
	uint32_t can_id_flow_ctrl;		// CAN ID used for the flow control frame (formerly 'can_id_resp')
	cantp_can_msgtype can_msgtype;	// CAN frame msgtype (only PCANTP_CAN_MSGTYPE_STANDARD or PCANTP_CAN_MSGTYPE_EXTENDED is mandatory)
	uint8_t	can_tx_dlc;				// Default CAN DLC value to use with segmented messages
	cantp_netaddrinfo netaddrinfo;	// ISO-TP Network Address Information
} cantp_mapping;

// Represents a message rule for filtering.
typedef struct _cantp_msgrule {
	uintptr_t uid;					// Unique ID (read-only)
	cantp_msgtype type;				// type of the message
	cantp_can_info can_info;		// common CAN information
	cantp_netaddrinfo netaddrinfo;	// ISO-TP network address information
	cantp_msgoption_list options;	// specific options to override global CAN configuration
	uintptr_t reserved;				// reserved
} cantp_msgrule;

////////////////////////////////////////////////////////////
// Message definitions
////////////////////////////////////////////////////////////

// Represents the content of a generic message.
typedef struct _cantp_msgdata {
	cantp_msgflag flags;			// structure specific flags
	uint32_t length;				// Length of the message
	uint8_t* data;					// Data of the message
	cantp_netstatus netstatus;		// Network status
	cantp_msgoption_list* options;	// Defines specific options to override global message configuration
} cantp_msgdata;

// Represents the content of a standard CAN frame.
typedef struct _cantp_msgdata_can {
	cantp_msgflag flags;			// structure specific flags
	uint32_t length;				// Length of the message (0..8)
	uint8_t* data;					// Data of the message
	cantp_netstatus netstatus;		// Network status
	cantp_msgoption_list* options;	// Defines specific options to override global CAN configuration (not used yet)
	uint8_t	data_max[PCANTP_MAX_LENGTH_CAN_STANDARD]; // Data of the message (DATA[0]..DATA[7])
} cantp_msgdata_can;

// Represents the content of a CAN FD frame.
typedef struct _cantp_msgdata_canfd {
	cantp_msgflag flags;			// structure specific flags
	uint32_t length;				// Length of the message (0..64)
	uint8_t* data;					// Data of the message
	cantp_netstatus netstatus;		// Network status
	cantp_msgoption_list* options;	// Defines specific options to override global CAN configuration (not used yet)
	uint8_t data_max[PCANTP_MAX_LENGTH_CAN_FD]; // Data of the message (DATA[0]..DATA[63])
} cantp_msgdata_canfd;

// Represents the content of an ISO-TP message.
typedef struct _cantp_msgdata_isotp {
	cantp_msgflag flags;			// structure specific flags
	uint32_t length;				// Length of the data
	uint8_t* data;					// Data
	cantp_netstatus netstatus;		// Network status
	cantp_msgoption_list* options;	// Defines specific options to override global CAN configuration
	cantp_netaddrinfo netaddrinfo;	// ISO-TP network address information
	cantp_isotp_info reserved;		// Reserved ISO-TP information
} cantp_msgdata_isotp;


// A cantp_msg message is a generic CAN related message than can be either a standard CAN frame,
//  a CAN FD frame, an ISO-TP message, etc.
typedef struct _cantp_msg {
	cantp_msgtype type;			// type of the message
	cantp_msginfo reserved;		// misc. read-only information
	cantp_can_info can_info;	// common CAN information
	union {
		cantp_msgdata* any;			// shortcut to access msgdata as Generic content
		cantp_msgdata_can* can;		// shortcut to access msgdata as CAN content
		cantp_msgdata_canfd* canfd;	// shortcut to access msgdata as CAN-FD content
		cantp_msgdata_isotp* isotp;	// shortcut to access msgdata as ISO-TP content
	} msgdata;
} cantp_msg;

// Holds information on the communication progress of a message.
typedef struct _cantp_msgprogress {
	cantp_msgprogress_state state;	// State of the message
	uint8_t percentage;				// Progress of the transmission/reception in percent.
	cantp_msg* buffer;				// Buffer to get a copy of the pending message.
} cantp_msgprogress;

#pragma pack(pop)


////////////////////////////////////////////////////////////
//  PCAN-ISO-TP API function declarations
////////////////////////////////////////////////////////////

#ifdef __cplusplus
// extra operator for cantp_statustype
inline cantp_statustype	operator|	(cantp_statustype a, cantp_statustype b) { return static_cast<cantp_statustype>(static_cast<int>(a) | static_cast<int>(b)); };
inline cantp_statustype& operator|=	(cantp_statustype& a, cantp_statustype b) { return (a = (a | b)); };
inline cantp_statustype	operator&	(cantp_statustype a, cantp_statustype b) { return static_cast<cantp_statustype>(static_cast<int>(a) & static_cast<int>(b)); };
inline cantp_statustype& operator&=	(cantp_statustype& a, cantp_statustype b) { return (a = (a & b)); };
inline cantp_statustype operator~	(cantp_statustype a) { return static_cast<cantp_statustype>(~static_cast<int>(a)); };
// extra operator for cantp_status
inline cantp_status	operator|	(cantp_status a, cantp_status b) { return static_cast<cantp_status>(static_cast<int>(a) | static_cast<int>(b)); };
inline cantp_status& operator|=	(cantp_status& a, cantp_status  b) { return (a = (a | b)); };
inline cantp_status	operator&	(cantp_status a, cantp_status b) { return static_cast<cantp_status>(static_cast<int>(a) & static_cast<int>(b)); };
inline cantp_status& operator&=	(cantp_status& a, cantp_status  b) { return (a = (a & b)); };
inline cantp_status operator~	(cantp_status a) { return static_cast<cantp_status>(~static_cast<int>(a)); };
// extra operator for cantp_msgflag
inline cantp_msgflag operator|	 (cantp_msgflag a, cantp_msgflag b) { return static_cast<cantp_msgflag>(static_cast<int>(a) | static_cast<int>(b)); };
inline cantp_msgflag& operator|= (cantp_msgflag& a, cantp_msgflag  b) { return (a = (a | b)); };
inline cantp_msgflag operator&	 (cantp_msgflag a, cantp_msgflag b) { return static_cast<cantp_msgflag>(static_cast<int>(a) & static_cast<int>(b)); };
inline cantp_msgflag& operator&= (cantp_msgflag& a, cantp_msgflag  b) { return (a = (a & b)); };
inline cantp_msgflag operator~	 (cantp_msgflag a) { return static_cast<cantp_msgflag>(~static_cast<int>(a)); };
// extra operator for cantp_msgflag
inline cantp_can_msgtype operator|	 (cantp_can_msgtype a, cantp_can_msgtype b) { return static_cast<cantp_can_msgtype>(static_cast<int>(a) | static_cast<int>(b)); };
inline cantp_can_msgtype& operator|= (cantp_can_msgtype& a, cantp_can_msgtype  b) { return (a = (a | b)); };
inline cantp_can_msgtype operator&	 (cantp_can_msgtype a, cantp_can_msgtype b) { return static_cast<cantp_can_msgtype>(static_cast<int>(a) & static_cast<int>(b)); };
inline cantp_can_msgtype& operator&= (cantp_can_msgtype& a, cantp_can_msgtype  b) { return (a = (a & b)); };
inline cantp_can_msgtype operator~	 (cantp_can_msgtype a) { return static_cast<cantp_can_msgtype>(~static_cast<int>(a)); };
// extra operator for cantp_isotp_msgtype
inline cantp_isotp_msgtype operator|	(cantp_isotp_msgtype a, cantp_isotp_msgtype b) { return static_cast<cantp_isotp_msgtype>(static_cast<int>(a) | static_cast<int>(b)); };
inline cantp_isotp_msgtype& operator|=	(cantp_isotp_msgtype& a, cantp_isotp_msgtype  b) { return (a = (a | b)); };
inline cantp_isotp_msgtype operator&	(cantp_isotp_msgtype a, cantp_isotp_msgtype b) { return static_cast<cantp_isotp_msgtype>(static_cast<int>(a) & static_cast<int>(b)); };
inline cantp_isotp_msgtype& operator&=	(cantp_isotp_msgtype& a, cantp_isotp_msgtype  b) { return (a = (a & b)); };
inline cantp_isotp_msgtype operator~	 (cantp_isotp_msgtype a) { return static_cast<cantp_isotp_msgtype>(~static_cast<int>(a)); };
// extra operator for cantp_infostatus
inline cantp_infostatus operator|	(cantp_infostatus a, cantp_infostatus b) { return static_cast<cantp_infostatus>(static_cast<int>(a) | static_cast<int>(b)); };
inline cantp_infostatus& operator|=	(cantp_infostatus& a, cantp_infostatus  b) { return (a = (a | b)); };
inline cantp_infostatus operator&	(cantp_infostatus a, cantp_infostatus b) { return static_cast<cantp_infostatus>(static_cast<int>(a) & static_cast<int>(b)); };
inline cantp_infostatus& operator&=	(cantp_infostatus& a, cantp_infostatus  b) { return (a = (a & b)); };
inline cantp_infostatus operator~	 (cantp_infostatus a) { return static_cast<cantp_infostatus>(~static_cast<int>(a)); };
// extra operator for cantp_busstatus
inline cantp_busstatus operator|	(cantp_busstatus a, cantp_busstatus b) { return static_cast<cantp_busstatus>(static_cast<int>(a) | static_cast<int>(b)); };
inline cantp_busstatus& operator|=	(cantp_busstatus& a, cantp_busstatus  b) { return (a = (a | b)); };
inline cantp_busstatus operator&	(cantp_busstatus a, cantp_busstatus b) { return static_cast<cantp_busstatus>(static_cast<int>(a) & static_cast<int>(b)); };
inline cantp_busstatus& operator&=	(cantp_busstatus& a, cantp_busstatus  b) { return (a = (a & b)); };
inline cantp_busstatus operator~	(cantp_busstatus a) { return static_cast<cantp_busstatus>(~static_cast<int>(a)); };

extern "C" {
#define _DEF_ARG =0
#define _DEF_ARG_HW = (cantp_hwtype)0
#define _DEF_ARG_OK = PCANTP_STATUS_OK
#define _DEF_ARG_MSGTYPE = PCANTP_MSGTYPE_ANY
#else
#define _DEF_ARG
#define _DEF_ARG_HW
#define _DEF_ARG_OK
#define _DEF_ARG_MSGTYPE
#endif

/// <summary>
/// Initializes a PCANTP-Client based on a CANTP handle (without CAN-FD support)
/// </summary>
/// <remarks>Only one PCANTP-Client can be initialized per CAN-Channel</remarks>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="baudrate">The CAN Hardware speed</param>
/// <param name="hw_type">NON PLUG-N-PLAY: The type of hardware and operation mode</param>
/// <param name="io_port">NON PLUG-N-PLAY: The I/O address for the parallel port</param>
/// <param name="interrupt">NON PLUG-N-PLAY: Interrupt number of the parallel port</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_Initialize_2016(
	cantp_handle channel,
	cantp_baudrate baudrate,
	cantp_hwtype hw_type _DEF_ARG_HW,
	uint32_t io_port _DEF_ARG,
	uint16_t interrupt _DEF_ARG);

/// <summary>
/// Initializes a PCANTP-Client based on a CANTP Channel (including CAN-FD support)
/// </summary>
/// <param name="channel">The handle of a FD capable PCAN Channel</param>
/// <param name="bitrate_fd">"The speed for the communication (FD bit rate string)"</param>
/// <remarks>Only one PCANTP-Client can be initialized per CAN-Channel.
/// See PCAN_BR_* values
/// * Parameter and values must be separated by '='
/// * Couples of Parameter/value must be separated by ','
/// * Following Parameter must be filled out: f_clock, data_brp, data_sjw, data_tseg1, data_tseg2,
///   nom_brp, nom_sjw, nom_tseg1, nom_tseg2.
/// * Following Parameters are optional (not used yet): data_ssp_offset, nom_samp
///</remarks>
/// <example>f_clock_mhz=80,nom_brp=0,nom_tseg1=13,nom_tseg2=0,nom_sjw=0,data_brp=0,
/// data_tseg1=13,data_tseg2=0,data_sjw=0</example>
/// <returns>"A cantp_status code"</returns>
cantp_status __stdcall CANTP_InitializeFD_2016(
	cantp_handle channel,
	const cantp_bitrate bitrate_fd);

/// <summary>
/// Uninitializes a PCANTP-Client initialized before
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_Uninitialize_2016(
	cantp_handle channel);

/// <summary>
/// Resets the receive and transmit queues of a PCANTP-Client
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_Reset_2016(
	cantp_handle channel);

/// <summary>
/// Gets information about the internal BUS status of a PCANTP-Channel.
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_GetCanBusStatus_2016(
	cantp_handle channel);

/// <summary>
/// Reads a PCANTP message from the receive queue of a PCANTP-Client
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="msg_buffer">A cantp_msg structure buffer to store the PUDS message</param>
/// <param name="timestamp_buffer">A cantp_timestamp structure buffer to get
/// the reception time of the message. If this value is not desired, this parameter
/// should be passed as NULL</param>
/// <param name="msg_type">A cantp_msgtype structure buffer to filter the message to read.
///	If this value is not desired, this parameter should be passed as PCANTP_MSGTYPE_ANY</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_Read_2016(
	cantp_handle channel,
	cantp_msg* msg_buffer,
	cantp_timestamp* timestamp_buffer _DEF_ARG,
	cantp_msgtype msg_type _DEF_ARG_MSGTYPE);

/// <summary>
/// Gets progress information on a specific message
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="msg_buffer">A cantp_msg structure buffer matching the message to look for</param>
/// <param name="direction">The expected direction (incoming/outgoing) of the message</param>
/// <param name="msgprogress_buffer">A cantp_msgprogress structure buffer to store the progress information</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_GetMsgProgress_2016(
	cantp_handle channel,
	cantp_msg* msg_buffer,
	cantp_msgdirection direction,
	cantp_msgprogress* msgprogress_buffer);

/// <summary>
/// Adds a PCANTP message to the Transmit queue
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="msg_buffer">A cantp_msg buffer with the message to be sent</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_Write_2016(
	cantp_handle channel,
	cantp_msg* msg_buffer);

/// <summary>
/// Retrieves a PCANTP-Client value
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="parameter">The cantp_parameter parameter to get</param>
/// <param name="buffer">Buffer for the parameter value</param>
/// <param name="buffer_size">Size in bytes of the buffer</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_GetValue_2016(
	cantp_handle channel,
	cantp_parameter parameter,
	void* buffer,
	uint32_t buffer_size);

/// <summary>
/// Configures or sets a PCANTP-Client value
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="parameter">The cantp_parameter parameter to set</param>
/// <param name="buffer">Buffer with the value to be set</param>
/// <param name="buffer_size">Size in bytes of the buffer</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_SetValue_2016(
	cantp_handle channel,
	cantp_parameter parameter,
	void* buffer,
	uint32_t buffer_size);

/// <summary>
/// Adds a user-defined PCAN-TP mapping between CAN ID and Network Address Information
/// </summary>
/// <remark>
/// Defining a mapping enables ISO-TP communication with 11BITS CAN ID or
/// with opened Addressing Formats (like PCANTP_ISOTP_FORMAT_NORMAL or PCANTP_ISOTP_FORMAT_EXTENDED).
/// </remark>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="mapping">Buffer to the mapping to be added</param>
/// <returns>A cantp_status code : PCANTP_STATUS_OK is returned on success,
/// PCANTP_STATUS_WRONG_PARAM states invalid Network Address Information parameters.</returns>
cantp_status __stdcall CANTP_AddMapping_2016(
	cantp_handle channel,
	cantp_mapping* mapping);

/// <summary>
/// Removes all user-defined PCAN-TP mappings corresponding to a CAN ID
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="can_id">The mapped CAN ID to search for</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_RemoveMappings_2016(
	cantp_handle channel,
	uint32_t can_id);

/// <summary>
/// Removes a user-defined PCAN-TP mapping between a CAN ID and Network Address Information
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="uid">The identifier of the mapping</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_RemoveMapping_2016(
	cantp_handle channel,
	uintptr_t uid);

/// <summary>
/// Retrieves all the mappings defined for a PCAN-TP channel
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="buffer">A buffer to store an array of cantp_mapping.</param>
/// <param name="buffer_length">[In]The number of cantp_mapping element the buffer can store.
///	[Out]The actual number of element copied in the buffer.</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success,
///	PCANTP_STATUS_PARAM_BUFFER_TOO_SMALL if the number of mappings exceeds buffer_length.</returns>
cantp_status __stdcall CANTP_GetMappings_2016(
	cantp_handle channel,
	cantp_mapping* buffer,
	uint32_t* buffer_length);


/// <summary>
/// Adds an entry to the CAN-ID white-list filtering.
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="can_id_from">The lowest CAN ID wanted to be received</param>
/// <param name="can_id_to">The highest CAN ID wanted to be received</param>
/// <param name="ignore_can_msgtype">States if filter should check the CAN message type.</param>
/// <param name="can_msgtype">If ignore_can_msgtype is false, the value states which types of CAN frame should be allowed.</param>
/// <returns>A cantp_status code : PCANTP_STATUS_OK is returned on success, and PCANTP_STATUS_ALREADY_INITIALIZED otherwise.</returns>
cantp_status __stdcall CANTP_AddFiltering_2016(
	cantp_handle channel,
	uint32_t can_id_from,
	uint32_t can_id_to,
	bool ignore_can_msgtype,
	cantp_can_msgtype can_msgtype);

/// <summary>
/// Removes an entry from the CAN-ID white-list filtering.
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="can_id_from">The lowest CAN ID wanted to be removed</param>
/// <param name="can_id_to">The highest CAN ID wanted to be removed</param>
/// <param name="ignore_can_msgtype">States if filter should check the CAN message type.</param>
/// <param name="can_msgtype">If ignore_can_msgtype is false, the value states which types of CAN frame should be allowed.</param>
/// <returns>A cantp_status code : PCANTP_STATUS_OK is returned on success, and PCANTP_STATUS_ALREADY_INITIALIZED otherwise.</returns>
cantp_status __stdcall CANTP_RemoveFiltering_2016(
	cantp_handle channel,
	uint32_t can_id_from,
	uint32_t can_id_to,
	bool ignore_can_msgtype,
	cantp_can_msgtype can_msgtype);

/// <summary>
/// Adds an entry to the message's rules.
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="msgrule">The rule to insert.</param>
/// <returns>A cantp_status code : PCANTP_STATUS_OK is returned on success.</returns>
cantp_status __stdcall CANTP_AddMsgRule_2016(
	cantp_handle channel,
	cantp_msgrule* msgrule);

/// <summary>
/// Removes an entry from the message's rules.
/// </summary>
/// <param name="channel">A PCANTP Channel Handle representing a PCANTP-Client</param>
/// <param name="msgrule_uid">The unique ID of the rule to remove.</param>
/// <returns>A cantp_status code : PCANTP_STATUS_OK is returned on success.</returns>
cantp_status __stdcall CANTP_RemoveMsgRule_2016(
	cantp_handle channel,
	uintptr_t uid);

/// <summary>
/// Returns a descriptive text of a given cantp_status error
/// code, in any desired language
/// </summary>
/// <remarks>The current languages available for translation are:
/// Neutral (0x00), German (0x07), English (0x09), Spanish (0x0A),
/// Italian (0x10) and French (0x0C)</remarks>
/// <param name="error">A cantp_status error code</param>
/// <param name="language">Indicates a 'Primary language ID'</param>
/// <param name="buffer">Buffer for a null terminated char array</param>
/// <param name="buffer_size">Buffer size</param>
/// <returns>A cantp_status error code</returns>
cantp_status __stdcall CANTP_GetErrorText_2016(
	cantp_status error,
	uint16_t language,
	char* buffer,
	uint32_t buffer_size);

/// <summary>
/// Allocates a PCAN-TP message based on the given type
/// </summary>
/// <param name="msg_buffer">A cantp_msg structure buffer (it will be freed if required)</param>
/// <param name="type">Type of the message to allocate</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_MsgDataAlloc_2016(
	cantp_msg* msg_buffer,
	cantp_msgtype type);

/// <summary>
/// Initializes an allocated PCAN-TP message
/// </summary>
/// <param name="msg_buffer">An allocated cantp_msg structure buffer</param>
/// <param name="can_id">CAN identifier (ISO-TP message may ignore this parameter and use PCANTP_MAPPING_FLOW_CTRL_NONE (-1)</param>
/// <param name="can_msgtype">Combination of CAN message types (like "extended CAN ID", "FD", "RTR", etc. flags)</param>
/// <param name="data_length">Length of the data</param>
/// <param name="data">A buffer to initialize the message's data with. If NULL, message's data is initialized with zeros.</param>
/// <param name="netaddrinfo">Network address information of the ISO-TP message (only valid with an ISO-TP message)</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_MsgDataInit_2016(
	cantp_msg* msg_buffer,
	uint32_t can_id,
	cantp_can_msgtype can_msgtype,
	uint32_t data_length,
	const void* data,
	cantp_netaddrinfo* netaddrinfo _DEF_ARG);

/// <summary>
/// Initializes a number of options for the PCAN-TP message that will override the channel's parameter(s)
/// </summary>
/// <param name="msg_buffer">An allocated cantp_msg structure buffer.</param>
/// <param name="nb_options">Number of options to initialize.</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_MsgDataInitOptions_2016(
	cantp_msg* msg_buffer,
	uint32_t nb_options);

/// <summary>
/// Deallocates a PCAN-TP message
/// </summary>
/// <param name="msg_buffer">An allocated cantp_msg structure buffer.</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_MsgDataFree_2016(
	cantp_msg* msg_buffer);

/// <summary>
/// Checks if two PCAN-TP messages are equal.
///	If one message is the indication of an incoming/outgoing ISO-TP message, the actual data-content will not be compared.
///	In that case the function checks if the messages' network address information matches.
/// </summary>
/// <param name="msg_buffer1">A cantp_msg structure buffer.</param>
/// <param name="msg_buffer2">Another cantp_msg structure buffer to compare with first parameter.</param>
/// <param name="ignoreSelfReceiveFlag">States if comparison should ignore loopback flag
///	(i.e if true the function will return true when comparing a request and its loopback confirmation).</param>
/// <returns>A boolean stating if the cantp_msgs are equal.</returns>
bool __stdcall CANTP_MsgEqual_2016(
	const cantp_msg* msg_buffer1,
	const cantp_msg* msg_buffer2,
	bool ignoreSelfReceiveFlag);

/// <summary>
/// Copies a PCAN-TP message to another buffer.
/// </summary>
/// <param name="msg_buffer_dst">A cantp_msg structure buffer to store the copied message.</param>
/// <param name="msg_buffer_src">The cantp_msg structure buffer used as the source.</param>
/// <returns>A cantp_status code. PCANTP_STATUS_OK is returned on success</returns>
cantp_status __stdcall CANTP_MsgCopy_2016(
	cantp_msg* msg_buffer_dst,
	const cantp_msg* msg_buffer_src);

/// <summary>
/// Converts a CAN DLC to its corresponding length.
/// </summary>
/// <param name="dlc">The Data Length Code (DLC) to convert.</param>
/// <returns>The corresponding length of the dlc parameter.</returns>
uint32_t __stdcall CANTP_MsgDlcToLength_2016(
	const uint8_t dlc);

/// <summary>
/// Converts a data length to a corresponding CAN DLC.
///	Note: the returned DLC can hold more data that the requested length.
/// </summary>
/// <param name="dlc">The length to convert.</param>
/// <returns>The smallest DLC that can hold the requested length (0x00-0x0F).</returns>
uint8_t __stdcall CANTP_MsgLengthToDlc_2016(
	const uint32_t length);

/// <summary>
/// Lists the subtypes contained in the PCAN-TP status.
/// </summary>
/// <param name="status">The status to analyze.</param>
/// <returns>An aggregation of cantp_statustype values.</returns>
cantp_statustype __stdcall CANTP_StatusListTypes_2016(
	const cantp_status status);

/// <summary>
/// Retrieves the value of a cantp_status subtype (like cantp_errstatus, cantp_busstatus, etc.).
/// </summary>
/// <param name="status">The status to analyze.</param>
/// <param name="type">The type of status to filter.</param>
/// <returns>The value of the enumeration matching the requested type.</returns>
uint32_t __stdcall CANTP_StatusGet_2016(
	const cantp_status status,
	const cantp_statustype type);

/// <summary>
/// Checks if a status matches an expected result (default is PCANTP_STATUS_OK).
/// </summary>
/// <param name="status">The status to analyze.</param>
/// <param name="status_expected">The expected status (default is PCANTP_STATUS_OK).</param>
/// <param name="strict">Enable strict mode (default is false). Strict mode ensures that bus or extra information are the same.</param>
/// <returns>Returns true if the status matches expected parameter.</returns>
bool __stdcall CANTP_StatusIsOk_2016(
	const cantp_status status,
	const cantp_status status_expected _DEF_ARG_OK,
	bool strict _DEF_ARG);

#ifdef __cplusplus
}
#endif

#endif
