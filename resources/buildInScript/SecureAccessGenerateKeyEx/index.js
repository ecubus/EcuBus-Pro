// Import ECB library
const ECB = require('../../lib/js')

// Global variables to track current block and max chunk size
let sa
let key = null
let sendKeyVal

// Initialize utility functions
Util.Init(() => {
  const testerName = Util.getTesterName();

  // Register main RequestDownloadBin function
  Util.Register(`${testerName}.SecureAccessGenerateKeyEx`, async function (dllFile, requestSeed, sendKey, securityLevel, variant, maxKeyArraySize, securityAccessDataRecord) {

    sa = new ECB.SecureAccessDll(dllFile)
    // Create request for service 0x27 (SecurityAccess)
    const r27Request = new ECB.DiagRequest(testerName, {
      id: "",
      name: "requstSeed",
      serviceId: "0x27",
      params: [],
      respParams: []
    });

    sendKeyVal = sendKey
    // Set raw request data by concatenating buffers
    r27Request.diagSetRaw(Buffer.concat([Buffer.from([0x27, requestSeed]), securityAccessDataRecord]));

    // Handle response from ECU
    r27Request.On("recv", (resp) => {
      const data = resp.diagGetRaw();
      const seed = data.subarray(2)
      try {
        key = sa.GenerateKeyEx(seed, securityLevel, variant, Buffer.alloc(maxKeyArraySize).fill(0))
      } catch (e) {
        console.error(`GenerateKeyEx error: ${e}`)
      }
    });

    // Create temporary job for handling data transfer
    const job = new ECB.DiagJob(testerName, {
      id: "SecureAccessGenerateKeyEx_tmpJob",
      name: "SecureAccessGenerateKeyEx_tmpJob",
      serviceId: "Job",
      params: [],
      respParams: []
    });

    return [r27Request, job];
  });

  // Register temporary job handler for data transfer
  Util.Register(`${testerName}.SecureAccessGenerateKeyEx_tmpJob`, () => {
    // Validate chunk size
    if (key == null) {
      throw new Error("key is null");
    }
    const r27Request = new ECB.DiagRequest(testerName, {
      id: "",
      name: "sendKey",
      serviceId: "0x27",
      params: [],
      respParams: []
    });

    // Set raw request data by concatenating buffers
    r27Request.diagSetRaw(Buffer.concat([Buffer.from([0x27, sendKeyVal]), key]));
    return [r27Request];

  });
});

/*! For license information please see uds.js.LICENSE.txt */
//# sourceMappingURL=tester.js.map
