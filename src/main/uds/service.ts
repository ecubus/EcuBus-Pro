import path from 'path'
import { Param, ServiceDetailItem, ServiceDetial, ServiceId } from '../share/uds'
import buildInScript from './../../../resources/buildInScript/.gitkeep?asset&asarUnpack'
import { globSync } from 'glob'
import fs from 'fs'
export const SupportServiceId: ServiceId[] = [
  '0x10',
  '0x11',
  '0x27',
  '0x28',
  '0x29',
  '0x3E',
  '0x83',
  '0x84',
  '0x85',
  '0x87',
  '0x22',
  '0x23',
  '0x24',
  '0x2A',
  '0x2C',
  '0x2E',
  '0x3D',
  '0x14',
  '0x19',
  '0x2F',
  '0x31',
  '0x34',
  '0x35',
  '0x36',
  '0x37',
  '0x38',
  'Job'
]

/**
 * @category UDS
 */

export const serviceDetail: ServiceDetial = {
  '0x10': {
    name: 'DiagnosticSessionControl',
    hasSubFunction: true,
    defaultParams: [
      {
        param: {
          id: 'diagnosticSessionType',
          name: 'diagnosticSessionType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0x00'
        },
        enum: [
          {
            name: 'DefaultSession',
            value: '0x01'
          },
          {
            name: 'ProgrammingSession',
            value: '0x02'
          },
          {
            name: 'ExtendedDiagnosticSession',
            value: '0x03'
          },
          {
            name: 'SafetySystemDiagnosticSession',
            value: '0x04'
          }
        ]
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'diagnosticSessionType',
          name: 'diagnosticSessionType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0x00'
        },
        enum: [
          {
            name: 'DefaultSession',
            value: '0x01'
          },
          {
            name: 'ProgrammingSession',
            value: '0x02'
          },
          {
            name: 'ExtendedDiagnosticSession',
            value: '0x03'
          },
          {
            name: 'SafetySystemDiagnosticSession',
            value: '0x04'
          }
        ]
      },
      {
        param: {
          id: 'sessionParameterRecord',
          name: 'sessionParameterRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x11': {
    name: 'ECUReset',
    hasSubFunction: true,
    defaultParams: [
      {
        param: {
          id: 'resetType',
          name: 'resetType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([1]),
          phyValue: '0x01'
        },
        enum: [
          {
            name: 'HardReset',
            value: '0x01'
          },
          {
            name: 'KeyOffOnReset',
            value: '0x02'
          },
          {
            name: 'SoftReset',
            value: '0x03'
          },
          {
            name: 'enableRapidPowerShutDown',
            value: '0x04'
          },
          {
            name: 'disableRapidPowerShutDown',
            value: '0x05'
          }
        ]
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'resetType',
          name: 'resetType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([1]),
          phyValue: '0x01'
        },
        enum: [
          {
            name: 'HardReset',
            value: '0x01'
          },
          {
            name: 'KeyOffOnReset',
            value: '0x02'
          },
          {
            name: 'SoftReset',
            value: '0x03'
          },
          {
            name: 'enableRapidPowerShutDown',
            value: '0x04'
          },
          {
            name: 'disableRapidPowerShutDown',
            value: '0x05'
          }
        ]
      },
      {
        param: {
          id: 'powerDownTime',
          name: 'powerDownTime',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x14': {
    name: 'ClearDiagnosticInformation',
    hasSubFunction: false,

    defaultParams: [
      {
        param: {
          id: 'groupOfDTC',
          name: 'groupOfDTC',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0'
        }
      }
    ],
    defaultRespParams: []
  },
  '0x19': {
    name: 'ReadDTCInformation',
    hasSubFunction: true,

    defaultParams: [
      {
        param: {
          id: 'reportType',
          name: 'reportType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([1]),
          phyValue: '0x01'
        },
        enum: [
          {
            name: 'reportNumberOfDTCByStatusMask',
            value: '0x01'
          },
          {
            name: 'reportDTCByStatusMask',
            value: '0x02'
          },
          {
            name: 'reportDTCSnapshotIdentification',
            value: '0x03'
          },
          {
            name: 'reportDTCSnapshotRecordByDTCNumber',
            value: '0x04'
          },
          {
            name: 'reportDTCStoredDataByRecordNumber',
            value: '0x05'
          },
          {
            name: 'reportDTCExtDataRecordByDTCNumber',
            value: '0x06'
          },
          {
            name: 'reportNumberOfDTCBySeverityMaskRecord',
            value: '0x07'
          },
          {
            name: 'reportDTCBySeverityMaskRecord',
            value: '0x08'
          },
          {
            name: 'reportSeverityInformationOfDTC',
            value: '0x09'
          },
          {
            name: 'reportSupportedDTC',
            value: '0x0A'
          },
          {
            name: 'reportFirstTestFailedDTC',
            value: '0x0B'
          },
          {
            name: 'reportFirstConfirmedDTC',
            value: '0x0C'
          },
          {
            name: 'reportMostRecentTestFailedDTC',
            value: '0x0D'
          },
          {
            name: 'reportMostRecentConfirmedDTC',
            value: '0x0E'
          },
          {
            name: 'reportMirrorMemoryDTCByStatusMask',
            value: '0x0F'
          },
          {
            name: 'reportMirrorMemoryDTCExtDataRecordByDTCNumber',
            value: '0x10'
          },
          {
            name: 'reportNumberOfMirrorMemoryDTCByStatusMask',
            value: '0x11'
          },
          {
            name: 'reportNumberOfEmissionsOBDDTCByStatusMask',
            value: '0x12'
          },
          {
            name: 'reportEmissionsOBDDTCByStatusMask',
            value: '0x13'
          },
          {
            name: 'reportDTCFaultDetectionCounter',
            value: '0x14'
          },
          {
            name: 'reportDTCWithPermanentStatus',
            value: '0x15'
          },
          {
            name: 'reportUserDefMemoryDTCByStatusMask',
            value: '0x17'
          },
          {
            name: 'reportUserDefMemoryDTCSnapshotRecordByDTCNumber',
            value: '0x18'
          },
          {
            name: 'reportUserDefMemoryDTCExtDataRecordByDTCNumber',
            value: '0x19'
          },
          {
            name: 'reportWWHOBDDTCByMaskRecord',
            value: '0x42'
          },
          {
            name: 'reportWWHOBDDTCWithPermanentStatus',
            value: '0x55'
          }
        ]
      },
      {
        param: {
          id: 'parameters',
          name: 'parameters',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'reportType',
          name: 'reportType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([1]),
          phyValue: '0x01'
        },
        enum: [
          {
            name: 'reportNumberOfDTCByStatusMask',
            value: '0x01'
          },
          {
            name: 'reportDTCByStatusMask',
            value: '0x02'
          },
          {
            name: 'reportDTCSnapshotIdentification',
            value: '0x03'
          },
          {
            name: 'reportDTCSnapshotRecordByDTCNumber',
            value: '0x04'
          },
          {
            name: 'reportDTCStoredDataByRecordNumber',
            value: '0x05'
          },
          {
            name: 'reportDTCExtDataRecordByDTCNumber',
            value: '0x06'
          },
          {
            name: 'reportNumberOfDTCBySeverityMaskRecord',
            value: '0x07'
          },
          {
            name: 'reportDTCBySeverityMaskRecord',
            value: '0x08'
          },
          {
            name: 'reportSeverityInformationOfDTC',
            value: '0x09'
          },
          {
            name: 'reportSupportedDTC',
            value: '0x0A'
          },
          {
            name: 'reportFirstTestFailedDTC',
            value: '0x0B'
          },
          {
            name: 'reportFirstConfirmedDTC',
            value: '0x0C'
          },
          {
            name: 'reportMostRecentTestFailedDTC',
            value: '0x0D'
          },
          {
            name: 'reportMostRecentConfirmedDTC',
            value: '0x0E'
          },
          {
            name: 'reportMirrorMemoryDTCByStatusMask',
            value: '0x0F'
          },
          {
            name: 'reportMirrorMemoryDTCExtDataRecordByDTCNumber',
            value: '0x10'
          },
          {
            name: 'reportNumberOfMirrorMemoryDTCByStatusMask',
            value: '0x11'
          },
          {
            name: 'reportNumberOfEmissionsOBDDTCByStatusMask',
            value: '0x12'
          },
          {
            name: 'reportEmissionsOBDDTCByStatusMask',
            value: '0x13'
          },
          {
            name: 'reportDTCFaultDetectionCounter',
            value: '0x14'
          },
          {
            name: 'reportDTCWithPermanentStatus',
            value: '0x15'
          },
          {
            name: 'reportUserDefMemoryDTCByStatusMask',
            value: '0x17'
          },
          {
            name: 'reportUserDefMemoryDTCSnapshotRecordByDTCNumber',
            value: '0x18'
          },
          {
            name: 'reportUserDefMemoryDTCExtDataRecordByDTCNumber',
            value: '0x19'
          },
          {
            name: 'reportWWHOBDDTCByMaskRecord',
            value: '0x42'
          },
          {
            name: 'reportWWHOBDDTCWithPermanentStatus',
            value: '0x55'
          }
        ]
      },
      {
        param: {
          id: 'data',
          name: 'data',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x22': {
    name: 'ReadDataByIdentifier',
    hasSubFunction: false,
    defaultParams: [
      {
        param: {
          id: 'dataIdentifier',
          name: 'dataIdentifier',
          bitLen: 16,
          deletable: false,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0, 0x0]),
          phyValue: '00 00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'dataIdentifier',
          name: 'dataIdentifier',
          bitLen: 16,
          deletable: false,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0, 0x0]),
          phyValue: '00 00'
        }
      },
      {
        param: {
          id: 'data',
          name: 'data',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x23': {
    name: 'ReadMemoryByAddress',
    hasSubFunction: false,

    defaultParams: [
      {
        param: {
          id: 'addressAndLengthFormatIdentifier',
          name: 'addressAndLengthFormatIdentifier',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0x00'
        }
      },
      {
        param: {
          id: 'memoryAddress',
          name: 'memoryAddress',
          bitLen: 32,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0, 0x0, 0x0]),
          phyValue: '0'
        }
      },
      {
        param: {
          id: 'memorySize',
          name: 'memorySize',
          bitLen: 32,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0, 0x0, 0x0]),
          phyValue: '0'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'dataRecord',
          name: 'dataRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x24': {
    name: 'ReadScalingDataByIdentifier',
    hasSubFunction: false,

    defaultParams: [
      {
        param: {
          id: 'dataIdentifier',
          name: 'dataIdentifier',
          bitLen: 16,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0]),
          phyValue: '00 00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'dataIdentifier',
          name: 'dataIdentifier',
          bitLen: 16,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0]),
          phyValue: '00 00'
        }
      },
      {
        param: {
          id: 'scalingByte',
          name: 'scalingByte',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0x00'
        }
      },
      {
        param: {
          id: 'optionalScalingInfo',
          name: 'optionalScalingInfo',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0x00'
        }
      }
    ]
  },
  '0x27': {
    name: 'SecurityAccess',
    hasSubFunction: true,
    defaultParams: [
      {
        param: {
          id: 'securityAccessType',
          name: 'securityAccessType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0x00'
        },
        enum: [
          {
            name: 'requestSeed',
            value: '0x01'
          },
          {
            name: 'sendKey',
            value: '0x02'
          },
          {
            name: 'requestSeed',
            value: '0x03'
          },
          {
            name: 'sendKey',
            value: '0x04'
          },
          {
            name: 'requestSeed',
            value: '0x05'
          },
          {
            name: 'sendKey',
            value: '0x06'
          },
          {
            name: 'requestSeed',
            value: '0x07'
          }
        ]
      },
      {
        param: {
          id: 'data',
          name: 'data',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'securityAccessType',
          name: 'securityAccessType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0x00'
        },
        enum: [
          {
            name: 'requestSeed',
            value: '0x01'
          },
          {
            name: 'sendKey',
            value: '0x02'
          },
          {
            name: 'requestSeed',
            value: '0x03'
          },
          {
            name: 'sendKey',
            value: '0x04'
          },
          {
            name: 'requestSeed',
            value: '0x05'
          },
          {
            name: 'sendKey',
            value: '0x06'
          },
          {
            name: 'requestSeed',
            value: '0x07'
          }
        ]
      },
      {
        param: {
          id: 'securitySeed',
          name: 'securitySeed',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x28': {
    name: 'CommunicationControl',
    hasSubFunction: true,

    defaultParams: [
      {
        param: {
          id: 'controlType',
          name: 'controlType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0x00'
        },
        enum: [
          {
            name: 'enableRxAndTx',
            value: '0x00'
          },
          {
            name: 'enableRxAndDisableTx',
            value: '0x01'
          },
          {
            name: 'disableRxAndEnableTx',
            value: '0x02'
          },
          {
            name: 'disableRxAndTx',
            value: '0x03'
          },
          {
            name: 'enableRxAndDisableTxWithEnhancedAddressInformation',
            value: '0x04'
          },
          {
            name: 'enableRxAndTxWithEnhancedAddressInformation',
            value: '0x05'
          }
        ]
      },
      {
        param: {
          id: 'communicationType',
          name: 'communicationType',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0x00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'controlType',
          name: 'controlType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0x00'
        },
        enum: [
          {
            name: 'enableRxAndTx',
            value: '0x00'
          },
          {
            name: 'enableRxAndDisableTx',
            value: '0x01'
          },
          {
            name: 'disableRxAndEnableTx',
            value: '0x02'
          },
          {
            name: 'disableRxAndTx',
            value: '0x03'
          },
          {
            name: 'enableRxAndDisableTxWithEnhancedAddressInformation',
            value: '0x04'
          },
          {
            name: 'enableRxAndTxWithEnhancedAddressInformation',
            value: '0x05'
          }
        ]
      }
    ]
  },
  '0x29': {
    name: 'Authentication',
    hasSubFunction: true,

    defaultParams: [
      {
        param: {
          id: 'authenticationType',
          name: 'authenticationType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0x00'
        },
        enum: [
          {
            name: 'deAuthenticate',
            value: '0x00'
          },
          {
            name: 'verifyCertificateUnidirectional',
            value: '0x01'
          },
          {
            name: 'verifyCertificateBidirectional',
            value: '0x02'
          },
          {
            name: 'proofOfOwnership',
            value: '0x03'
          },
          {
            name: 'transmitCertificate',
            value: '0x04'
          },
          {
            name: 'requestChallengeForAuthentication',
            value: '0x05'
          },
          {
            name: 'verifyProofOfOwnershipUnidirectional',
            value: '0x06'
          },
          {
            name: 'verifyProofOfOwnershipBidirectional',
            value: '0x07'
          },
          {
            name: 'authenticationConfiguration',
            value: '0x08'
          }
        ]
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'authenticationType',
          name: 'authenticationType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '0x00'
        },
        enum: [
          {
            name: 'deAuthenticate',
            value: '0x00'
          },
          {
            name: 'verifyCertificateUnidirectional',
            value: '0x01'
          },
          {
            name: 'verifyCertificateBidirectional',
            value: '0x02'
          },
          {
            name: 'proofOfOwnership',
            value: '0x03'
          },
          {
            name: 'transmitCertificate',
            value: '0x04'
          },
          {
            name: 'requestChallengeForAuthentication',
            value: '0x05'
          },
          {
            name: 'verifyProofOfOwnershipUnidirectional',
            value: '0x06'
          },
          {
            name: 'verifyProofOfOwnershipBidirectional',
            value: '0x07'
          },
          {
            name: 'authenticationConfiguration',
            value: '0x08'
          }
        ]
      }
    ]
  },
  '0x2A': {
    name: 'ReadDataByPeriodicIdentifier',
    hasSubFunction: false,

    defaultParams: [
      {
        param: {
          id: 'transmissionMode',
          name: 'transmissionMode',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'periodicDataIdentifiers',
          name: 'periodicDataIdentifiers',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'periodicDataIdentifiers',
          name: 'periodicDataIdentifiers',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'data',
          name: 'data',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x2C': {
    name: 'DynamicallyDefineDataIdentifier',
    hasSubFunction: true,
    defaultParams: [
      {
        param: {
          id: 'definitionType',
          name: 'definitionType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        },
        enum: [
          {
            name: 'defineByIdentifier',
            value: '0x01'
          },
          {
            name: 'defineByMemoryAddress',
            value: '0x02'
          }
        ]
      },
      {
        param: {
          id: 'dynamicallyDefinedDataIdentifier',
          name: 'dynamicallyDefinedDataIdentifier',
          bitLen: 16,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0]),
          phyValue: '00 00'
        }
      },
      {
        param: {
          id: 'data',
          name: 'data',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'definitionType',
          name: 'definitionType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        },
        enum: [
          {
            name: 'defineByIdentifier',
            value: '0x01'
          },
          {
            name: 'defineByMemoryAddress',
            value: '0x02'
          }
        ]
      },
      {
        param: {
          id: 'dynamicallyDefinedDataIdentifier',
          name: 'dynamicallyDefinedDataIdentifier',
          bitLen: 16,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0]),
          phyValue: '00 00'
        }
      }
    ]
  },
  '0x2E': {
    name: 'WriteDataByIdentifier',
    hasSubFunction: false,

    defaultParams: [
      {
        param: {
          id: 'dataIdentifier',
          name: 'dataIdentifier',
          bitLen: 16,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'dataRecord',
          name: 'dataRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'dataIdentifier',
          name: 'dataIdentifier',
          bitLen: 16,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x2F': {
    name: 'InputOutputControlByIdentifier',
    hasSubFunction: false,
    defaultParams: [
      {
        param: {
          id: 'dataIdentifier',
          name: 'dataIdentifier',
          bitLen: 16,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'inputOutputControlParameter',
          name: 'inputOutputControlParameter',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'controlState',
          name: 'controlState',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'dataIdentifier',
          name: 'dataIdentifier',
          bitLen: 16,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'inputOutputControlParameter',
          name: 'inputOutputControlParameter',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'controlState',
          name: 'controlState',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },

  '0x31': {
    name: 'RoutineControl',
    hasSubFunction: true,
    defaultParams: [
      {
        param: {
          id: 'routineControlType',
          name: 'routineControlType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        },
        enum: [
          {
            name: 'startRoutine',
            value: '0x01'
          },
          {
            name: 'stopRoutine',
            value: '0x02'
          },
          {
            name: 'requestRoutineResults',
            value: '0x03'
          }
        ]
      },
      {
        param: {
          id: 'routineIdentifier',
          name: 'routineIdentifier',
          bitLen: 16,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'routineControlOptionRecord',
          name: 'routineControlOptionRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'routineControlType',
          name: 'routineControlType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        },
        enum: [
          {
            name: 'startRoutine',
            value: '0x01'
          },
          {
            name: 'stopRoutine',
            value: '0x02'
          },
          {
            name: 'requestRoutineResults',
            value: '0x03'
          }
        ]
      },
      {
        param: {
          id: 'routineIdentifier',
          name: 'routineIdentifier',
          bitLen: 16,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'routineStatusRecord',
          name: 'routineStatusRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x34': {
    name: 'RequestDownload',
    hasSubFunction: false,
    defaultParams: [
      {
        param: {
          id: 'dataFormatIdentifier',
          name: 'dataFormatIdentifier',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'addressAndLengthFormatIdentifier',
          name: 'addressAndLengthFormatIdentifier',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'memoryAddress',
          name: 'memoryAddress',
          bitLen: 32,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0, 0x0, 0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'memorySize',
          name: 'memorySize',
          bitLen: 32,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0, 0x0, 0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'lengthFormatIdentifier',
          name: 'lengthFormatIdentifier',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'maxNumberOfBlockLength',
          name: 'maxNumberOfBlockLength',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x35': {
    name: 'RequestUpload',
    hasSubFunction: false,
    defaultParams: [
      {
        param: {
          id: 'dataFormatIdentifier',
          name: 'dataFormatIdentifier',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'addressAndLengthFormatIdentifier',
          name: 'addressAndLengthFormatIdentifier',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'memoryAddress',
          name: 'memoryAddress',
          bitLen: 32,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0, 0x0, 0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'memorySize',
          name: 'memorySize',
          bitLen: 32,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0, 0x0, 0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'lengthFormatIdentifier',
          name: 'lengthFormatIdentifier',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'maxNumberOfBlockLength',
          name: 'maxNumberOfBlockLength',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x36': {
    name: 'TransferData',
    hasSubFunction: false,

    defaultParams: [
      {
        param: {
          id: 'blockSequenceCounter',
          name: 'blockSequenceCounter',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'transferRequestParameterRecord',
          name: 'transferRequestParameterRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'blockSequenceCounter',
          name: 'blockSequenceCounter',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'transferResponseParameterRecord',
          name: 'transferResponseParameterRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x37': {
    name: 'RequestTransferExit',
    hasSubFunction: false,

    defaultParams: [
      {
        param: {
          id: 'transferRequestParameterRecord',
          name: 'transferRequestParameterRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'transferResponseParameterRecord',
          name: 'transferResponseParameterRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x38': {
    name: 'RequestFileTransfer',
    hasSubFunction: false,
    defaultParams: [],
    defaultRespParams: []
  },

  '0x3D': {
    name: 'WriteMemoryByAddress',
    hasSubFunction: false,

    defaultParams: [
      {
        param: {
          id: 'addressAndLengthFormatIdentifier',
          name: 'addressAndLengthFormatIdentifier',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'memoryAddress',
          name: 'memoryAddress',
          bitLen: 32,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0, 0x0, 0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'memorySize',
          name: 'memorySize',
          bitLen: 32,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0, 0x0, 0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'data',
          name: 'data',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'addressAndLengthFormatIdentifier',
          name: 'addressAndLengthFormatIdentifier',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'memoryAddress',
          name: 'memoryAddress',
          bitLen: 32,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0, 0x0, 0x0]),
          phyValue: '00'
        }
      },
      {
        param: {
          id: 'memorySize',
          name: 'memorySize',
          bitLen: 32,
          deletable: true,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0, 0x0, 0x0, 0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x3E': {
    name: 'TesterPresent',
    hasSubFunction: false,
    defaultParams: [
      {
        param: {
          id: 'controlType',
          name: 'controlType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'controlType',
          name: 'controlType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x83': {
    name: 'AccessTimingParameter',
    hasSubFunction: true,
    defaultParams: [
      {
        param: {
          id: 'timingParameterAccessType',
          name: 'timingParameterAccessType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        },
        enum: [
          {
            name: 'readExtendedTimingParameterSet',
            value: '0x01'
          },
          {
            name: 'setTimingParametersToDefaultValues',
            value: '0x02'
          },
          {
            name: 'readCurrentlyActiveTimingParameters',
            value: '0x03'
          },
          {
            name: 'setTimingParametersToGivenValues',
            value: '0x04'
          }
        ]
      },
      {
        param: {
          id: 'timingParameterRequestRecord',
          name: 'timingParameterRequestRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],

    defaultRespParams: [
      {
        param: {
          id: 'timingParameterAccessType',
          name: 'timingParameterAccessType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00'
        },
        enum: [
          {
            name: 'readExtendedTimingParameterSet',
            value: '0x01'
          },
          {
            name: 'setTimingParametersToDefaultValues',
            value: '0x02'
          },
          {
            name: 'readCurrentlyActiveTimingParameters',
            value: '0x03'
          },
          {
            name: 'setTimingParametersToGivenValues',
            value: '0x04'
          }
        ]
      },
      {
        param: {
          id: 'timingParameterResponseRecord',
          name: 'timingParameterResponseRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x84': {
    name: 'SecuredDataTransmission',
    hasSubFunction: false,

    defaultParams: [
      {
        param: {
          id: 'securityDataRequestRecord',
          name: 'securityDataRequestRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          id: 'securityDataResponseRecord',
          name: 'securityDataResponseRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00'
        }
      }
    ]
  },
  '0x85': {
    name: 'ControlDTCSetting',
    hasSubFunction: true,

    defaultParams: [
      {
        param: {
          name: 'dtcSettingType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00',
          id: 'dtcSettingType'
        },
        enum: [
          {
            name: 'on',
            value: '0x01'
          },
          {
            name: 'off',
            value: '0x02'
          }
        ]
      },
      {
        param: {
          name: 'dtcSettingControlOptionRecord',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00',
          id: 'dtcSettingControlOptionRecord'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          name: 'dtcSettingType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00',
          id: 'dtcSettingType'
        },
        enum: [
          {
            name: 'on',
            value: '0x01'
          },
          {
            name: 'off',
            value: '0x02'
          }
        ]
      }
    ]
  },
  // "0x86": {
  //   name: "ResponseOnEvent",
  //   hasSubFunction: true,
  //   subFunctions: [
  //     //子功能的6bit和5-0bits分开定义了
  //   ],
  //   needParams: [
  //     {
  //       name: "subFunction",
  //       length: 1
  //     }
  //   ],
  // },
  '0x87': {
    name: 'LinkControl',
    hasSubFunction: true,

    defaultParams: [
      {
        param: {
          name: 'linkControlType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00',
          id: 'linkControlType'
        },
        enum: [
          {
            name: 'verifyModeTransitionWithFixedParameter',
            value: '0x01'
          },
          {
            name: 'verifyModeTransitionWithSpecificParameter',
            value: '0x02'
          },
          {
            name: 'transitionMode',
            value: '0x03'
          }
        ]
      },
      {
        param: {
          name: 'baudrate',
          bitLen: 8,
          deletable: true,
          editable: true,
          type: 'ARRAY',
          value: Buffer.from([0x0]),
          phyValue: '00',
          id: 'baudrate'
        }
      }
    ],
    defaultRespParams: [
      {
        param: {
          name: 'linkControlType',
          bitLen: 8,
          deletable: false,
          editable: true,
          type: 'NUM',
          value: Buffer.from([0x0]),
          phyValue: '00',
          id: 'linkControlType'
        },
        enum: [
          {
            name: 'verifyModeTransitionWithFixedParameter',
            value: '0x01'
          },
          {
            name: 'verifyModeTransitionWithSpecificParameter',
            value: '0x02'
          },
          {
            name: 'transitionMode',
            value: '0x03'
          }
        ]
      }
    ]
  },

  Job: {
    name: 'JobFunction',
    hasSubFunction: false,
    defaultParams: [],
    defaultRespParams: []
  }
}

const buildInScriptPath = path.dirname(buildInScript)

//buildInScriptPath/*/plugin.json

const pluginFiles = globSync('*/plugin.json', {
  cwd: buildInScriptPath
})

for (let pluginFile of pluginFiles) {
  try {
    pluginFile = path.join(buildInScriptPath, pluginFile)
    const plugin = JSON.parse(fs.readFileSync(pluginFile, 'utf8'))
    const item = plugin.service as ServiceDetailItem
    if (item.buildInScript) {
      const dir = path.dirname(pluginFile)
      item.buildInScript = path.join(dir, item.buildInScript)
      serviceDetail[item.name as ServiceId] = item
    }
  } catch (error) {
    null
  }
}
