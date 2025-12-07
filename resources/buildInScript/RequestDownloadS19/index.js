// Import ECB library
const ECB=require('../../lib/js')
const fsP = require('fs/promises')

// Queued blocks parsed from the s19 file
const pendingBlocks = [];
// Global variables to track current block and max chunk size
var currentBlock = void 0;
var maxChunkSize;
var testerName;
var dataFormatIdentifierCache;
var addressAndLengthFormatIdentifierCache;
var jobInstance;

// Initialize utility functions
Util.Init(() => {
  testerName = Util.getTesterName();

  // Build RequestDownload (0x34) for the current block
  const buildRequestDownload = () => {
    if (!currentBlock) {
      throw new Error("currentBlock is undefined");
    }

    const r34 = new ECB.DiagRequest(testerName, {
      id: "",
      name: "",
      serviceId: "0x34",
      params: [],
      respParams: []
    });

    const prefixBuffer = Buffer.from([0x34, dataFormatIdentifierCache & 0xff, addressAndLengthFormatIdentifierCache & 0xff]);

    // Create buffer for memory address based on format identifier
    const memoryAddressBuffer = Buffer.alloc(addressAndLengthFormatIdentifierCache & 0x0f);
    for (let i = 0; i < memoryAddressBuffer.length; i++) {
      memoryAddressBuffer[i] = currentBlock.addr >> (8 * (memoryAddressBuffer.length - 1 - i)) & 0xff;
    }

    // Create buffer for memory size based on format identifier
    const memorySizeBuffer = Buffer.alloc((addressAndLengthFormatIdentifierCache & 0xf0) >> 4);
    for (let i = 0; i < memorySizeBuffer.length; i++) {
      memorySizeBuffer[i] = currentBlock.data.length >> (8 * (memorySizeBuffer.length - 1 - i)) & 0xff;
    }

    // Set raw request data by concatenating buffers
    r34.diagSetRaw(Buffer.concat([prefixBuffer, memoryAddressBuffer, memorySizeBuffer]));

    // Handle response from ECU
    r34.On("recv", (resp) => {
      const data = resp.diagGetRaw();
      const lengthFormatIdentifier = (data[1] & 0xf0) >> 4;

      let maxNumberOfBlockLength = 0;
      // Calculate max block length from response
      for (let i = 0; i < lengthFormatIdentifier; i++) {
        maxNumberOfBlockLength += data[2 + i] * Math.pow(256, lengthFormatIdentifier - i - 1);
      }
      maxChunkSize = maxNumberOfBlockLength;
    });

    return r34;
  };

  // Register main RequestDownloadS19 function
  Util.Register(`${testerName}.RequestDownloadS19`, async function(dataFormatIdentifier, addressAndLengthFormatIdentifier, s19FilePath) {
    // reset state for each call
    pendingBlocks.length = 0;
    currentBlock = void 0;
    maxChunkSize = void 0;
    dataFormatIdentifierCache = dataFormatIdentifier;
    addressAndLengthFormatIdentifierCache = addressAndLengthFormatIdentifier;

    // parse s19 file into discrete memory blocks
    const s19Text = await fsP.readFile(s19FilePath, 'utf8');
    const memMap = ECB.S19MemoryMap.fromS19(s19Text);
    for (const [addr, data] of memMap) {
      pendingBlocks.push({ addr, data });
    }

    if (pendingBlocks.length === 0) {
      throw new Error("s19 file contains no data");
    }

    // prepare first block
    currentBlock = pendingBlocks.shift();

    const r34 = buildRequestDownload();

    // Create temporary job for handling data transfer
    const job = new ECB.DiagJob(testerName, {
      id: "RequestDownloadS19_tmpJob",
      name: "RequestDownloadS19_tmpJob",
      serviceId: "Job",
      params: [],
      respParams: []
    });
    jobInstance = job;

    return [r34, job];
  });

  // Register temporary job handler for data transfer
  Util.Register(`${testerName}.RequestDownloadS19_tmpJob`, () => {
    // Validate chunk size
    if (maxChunkSize == void 0 || maxChunkSize <= 2) {
      throw new Error("maxNumberOfBlockLength is undefined or too small");
    }

    if (currentBlock) {
      // Adjust chunk size for overhead
      let chunkSize = maxChunkSize - 2;
      if (chunkSize & 7) {
        chunkSize -= chunkSize & 7;
      }

      // Split data into chunks
      const numChunks = Math.ceil(currentBlock.data.length / chunkSize);
      const list = [];

      // Create transfer data requests (0x36) for each chunk
      for (let i = 0; i < numChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, currentBlock.data.length);
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
        blockSequenceCounter.writeUInt8((i + 1) & 0xff);
        r36.diagSetRaw(Buffer.concat([Buffer.from([0x36]), blockSequenceCounter, chunk]));
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
      r37.diagSetRaw(Buffer.from([0x37]));
      list.push(r37);

      // prepare next block if any
      currentBlock = void 0;
      maxChunkSize = void 0;
      if (pendingBlocks.length > 0) {
        currentBlock = pendingBlocks.shift();
        list.push(buildRequestDownload(), jobInstance);
      }

      return list;
    } else {
      return [];
    }
  });
});

/*! For license information please see uds.js.LICENSE.txt */
//# sourceMappingURL=tester.js.map

