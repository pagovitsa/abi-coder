const { keccak256, toUtf8Bytes } = require('ethers');
const Encoder = require('./lib/encoder');
const Decoder = require('./lib/decoder');
const { parseABI, getFunctionSelector, getEventSelector } = require('./lib/utils');

class ABICodec {
  constructor(abi) {
    this.abi = parseABI(abi);
    this.functions = new Map();
    this.events = new Map();
    
    // Pre-compile function and event info for performance
    this._compileFunctions();
    this._compileEvents();
    
    this.encoder = new Encoder();
    this.decoder = new Decoder();
  }
  
  _compileFunctions() {
    for (const item of this.abi) {
      if (item.type === 'function') {
        const selector = getFunctionSelector(item);
        this.functions.set(selector, item);
        // Also map by name for convenience
        this.functions.set(item.name, item);
      }
    }
  }
  
  _compileEvents() {
    for (const item of this.abi) {
      if (item.type === 'event') {
        const selector = getEventSelector(item);
        this.events.set(selector, item);
        // Also map by name for convenience
        this.events.set(item.name, item);
      }
    }
  }
  
  // Encode function call data
  encodeFunction(nameOrSelector, params = []) {
    const func = this.functions.get(nameOrSelector);
    if (!func) {
      throw new Error(`Function not found: ${nameOrSelector}`);
    }
    
    const selector = typeof nameOrSelector === 'string' && nameOrSelector.length === 10 
      ? nameOrSelector 
      : getFunctionSelector(func);
      
    const encoded = this.encoder.encodeParameters(func.inputs, params);
    return selector + encoded.slice(2); // Remove 0x from encoded params
  }
  
  // Decode function call data
  decodeFunction(nameOrSelector, data) {
    const func = this.functions.get(nameOrSelector);
    if (!func) {
      throw new Error(`Function not found: ${nameOrSelector}`);
    }
    
    // Remove function selector (first 4 bytes)
    const paramData = '0x' + data.slice(10);
    return this.decoder.decodeParameters(func.inputs, paramData);
  }
  
  // Decode function return data
  decodeFunctionResult(nameOrSelector, data) {
    const func = this.functions.get(nameOrSelector);
    if (!func) {
      throw new Error(`Function not found: ${nameOrSelector}`);
    }
    
    return this.decoder.decodeParameters(func.outputs || [], data);
  }
  
  // Decode event log
  decodeLog(data, topics, nameOrTopic0) {
    let event;
    
    if (nameOrTopic0) {
      event = this.events.get(nameOrTopic0);
    } else if (topics && topics.length > 0) {
      event = this.events.get(topics[0]);
    }
    
    if (!event) {
      throw new Error(`Event not found: ${nameOrTopic0 || topics[0]}`);
    }
    
    return this.decoder.decodeLog(event, data, topics);
  }
  
  // Decode all logs in a receipt that match any ABI events
  decodeReceiptLogs(receipt) {
    if (!receipt || !receipt.logs || !Array.isArray(receipt.logs)) {
      return [];
    }
    
    const decodedLogs = [];
    
    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i];
      
      // Skip logs without topics
      if (!log.topics || log.topics.length === 0) {
        continue;
      }
      
      const topic0 = log.topics[0];
      const event = this.events.get(topic0);
      
      if (event) {
        try {
          const decoded = this.decoder.decodeLog(event, log.data, log.topics);
          decodedLogs.push({
            ...decoded,
            logIndex: i,
            address: log.address,
            blockHash: log.blockHash,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            transactionIndex: log.transactionIndex,
            removed: log.removed
          });
        } catch (error) {
          // Skip logs that can't be decoded (might be from other contracts)
          continue;
        }
      }
    }
    
    return decodedLogs;
  }
  
  // Decode all logs from multiple receipts
  decodeMultipleReceipts(receipts) {
    if (!Array.isArray(receipts)) {
      throw new Error('Expected array of receipts');
    }
    
    const allDecodedLogs = [];
    
    for (const receipt of receipts) {
      const decodedLogs = this.decodeReceiptLogs(receipt);
      allDecodedLogs.push(...decodedLogs);
    }
    
    return allDecodedLogs;
  }
  
  // Filter decoded logs by event name
  filterLogsByEvent(decodedLogs, eventName) {
    return decodedLogs.filter(log => log.name === eventName);
  }
  
  // Get all event topics that this codec can decode
  getKnownEventTopics() {
    const topics = [];
    for (const [key, value] of this.events.entries()) {
      if (key.startsWith('0x') && key.length === 66) { // Topic format
        topics.push(key);
      }
    }
    return topics;
  }
}

module.exports = { ABICodec };
