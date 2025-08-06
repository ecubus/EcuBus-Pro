// Import ECB library
const ECB=require('../../lib/js')
const fsP = require('fs/promises')

// Global variables to track current block and max chunk size
var currentBlock = void 0;
var maxChunkSize;

// Initialize utility functions
Util.Init(() => {
  const testerName = Util.getTesterName();

  // Register main RequestDownloadBin function
  Util.Register(`${testerName}.RequestDownloadBin`, async function(dataFormatIdentifier, addressAndLengthFormatIdentifier, memoryAddress, binFilePath) {
    // Create request for service 0x34 (RequestDownload)
    const r34 = new ECB.DiagRequest(testerName, {
      id: "",
      name: "",
      serviceId: "0x34",
      params: [],
      respParams: []
    });

    // Prepare request data buffers
    const prefixBuffer = Buffer.from([52, dataFormatIdentifier & 255, addressAndLengthFormatIdentifier & 255]);
    
    // Create buffer for memory address based on format identifier
    const memoryAddressBuffer = Buffer.alloc(addressAndLengthFormatIdentifier & 15);
    for (let i = 0; i < memoryAddressBuffer.length; i++) {
      memoryAddressBuffer[i] = memoryAddress >> 8 * (memoryAddressBuffer.length - 1 - i) & 255;
    }

    // Create buffer for memory size based on format identifier
    const memorySizeBuffer = Buffer.alloc((addressAndLengthFormatIdentifier & 240) >> 4);
    const binFile = await fsP.readFile(binFilePath)
    for (let i = 0; i < memorySizeBuffer.length; i++) {
      memorySizeBuffer[i] = binFile.length >> 8 * (memorySizeBuffer.length - 1 - i) & 255;
    }

    let maxNumberOfBlockLength = 0;
    
    // Set raw request data by concatenating buffers
    r34.diagSetRaw(Buffer.concat([prefixBuffer, memoryAddressBuffer, memorySizeBuffer]));

    // Handle response from ECU
    r34.On("recv", (resp) => {
      const data = resp.diagGetRaw();
      const lengthFormatIdentifier = (data[1] & 240) >> 4;
      
      // Calculate max block length from response
      for (let i = 0; i < lengthFormatIdentifier; i++) {
        maxNumberOfBlockLength += data[2 + i] * Math.pow(256, lengthFormatIdentifier - i - 1);
      }
      maxChunkSize = maxNumberOfBlockLength;
      currentBlock = {
        addr: memoryAddress,
        data: binFile
      };
    });

    // Create temporary job for handling data transfer
    const job = new ECB.DiagJob(testerName, {
      id: "RequestDownloadBin_tmpJob",
      name: "RequestDownloadBin_tmpJob", 
      serviceId: "Job",
      params: [],
      respParams: []
    });

    return [r34, job];
  });

  // Register temporary job handler for data transfer
  Util.Register(`${testerName}.RequestDownloadBin_tmpJob`, () => {
    // Validate chunk size
    if (maxChunkSize == void 0 || maxChunkSize <= 2) {
      throw new Error("maxNumberOfBlockLength is undefined or too small");
    }

    if (currentBlock) {
      // Adjust chunk size for overhead
      maxChunkSize -= 2;
      if (maxChunkSize & 7) {
        maxChunkSize -= maxChunkSize & 7;
      }

      // Split data into chunks
      const numChunks = Math.ceil(currentBlock.data.length / maxChunkSize);
      const list = [];

      // Create transfer data requests (0x36) for each chunk
      for (let i = 0; i < numChunks; i++) {
        const start = i * maxChunkSize;
        const end = Math.min(start + maxChunkSize, currentBlock.data.length);
        const chunk = currentBlock.data.subarray(start, end);

        const r36 = new ECB.DiagRequest(testerName, {
          id: "",
          name: "",
          serviceId: "0x36",
          params: [],
          respParams: []
        });

        // Add block sequence counter
        const blockSequenceCounter = Buffer.alloc(1);
        blockSequenceCounter.writeUInt8(i + 1 & 255);
        r36.diagSetRaw(Buffer.concat([Buffer.from([54]), blockSequenceCounter, chunk]));
        list.push(r36);
      }

      // Create transfer exit request (0x37)
      const r37 = new ECB.DiagRequest(testerName, {
        id: "",
        name: "",
        serviceId: "0x37",
        params: [],
        respParams: []
      });
      r37.diagSetRaw(Buffer.from([55]));
      list.push(r37);

      // Reset global variables
      currentBlock = void 0;
      maxChunkSize = void 0;

      return list;
    } else {
      return [];
    }
  });
});

/*! For license information please see uds.js.LICENSE.txt */
//# sourceMappingURL=tester.js.map

