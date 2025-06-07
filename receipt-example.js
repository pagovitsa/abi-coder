const { ABICodec } = require('./index');

// Complete example showing receipt log decoding
console.log('📝 Receipt Log Decoding Examples\n');

// ABI for a typical ERC20 token with additional events
const tokenABI = [
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      {"name": "from", "type": "address", "indexed": true},
      {"name": "to", "type": "address", "indexed": true},
      {"name": "value", "type": "uint256", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "Approval",
    "inputs": [
      {"name": "owner", "type": "address", "indexed": true},
      {"name": "spender", "type": "address", "indexed": true},
      {"name": "value", "type": "uint256", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "Mint",
    "inputs": [
      {"name": "to", "type": "address", "indexed": true},
      {"name": "amount", "type": "uint256", "indexed": false}
    ]
  }
];

// Example transaction receipt (like from web3 or ethers)
const sampleReceipt = {
  transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  blockNumber: 18500000,
  gasUsed: '65000',
  status: 1,
  logs: [
    // Transfer event
    {
      address: '0xA0b86a33E6417c8C2B60C9B6D2b1f1d3F4E5F6a7',
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de6',
        '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de7'
      ],
      data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000',
      logIndex: 0
    },
    // Approval event
    {
      address: '0xA0b86a33E6417c8C2B60C9B6D2b1f1d3F4E5F6a7',
      topics: [
        '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
        '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de6',
        '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de8'
      ],
      data: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      logIndex: 1
    },
    // Unknown event (will be ignored)
    {
      address: '0xOtherContract123456789012345678901234567890',
      topics: ['0xunknownevent1234567890abcdef1234567890abcdef1234567890abcdef123'],
      data: '0x0000000000000000000000000000000000000000000000000000000000000001',
      logIndex: 2
    }
  ]
};

const codec = new ABICodec(tokenABI);

// Example 1: Decode all logs from a single receipt
console.log('Example 1: Decode Single Receipt');
const decodedLogs = codec.decodeReceiptLogs(sampleReceipt);

console.log(`Decoded ${decodedLogs.length} logs:`);
decodedLogs.forEach((log, i) => {
  console.log(`\n${i + 1}. ${log.name} Event:`);
  Object.entries(log.args).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });
  console.log(`   Contract: ${log.address}`);
  console.log(`   Log Index: ${log.logIndex}`);
});

// Example 2: Filter by specific event type
console.log('\n\nExample 2: Filter by Event Type');
const transferLogs = codec.filterLogsByEvent(decodedLogs, 'Transfer');
const approvalLogs = codec.filterLogsByEvent(decodedLogs, 'Approval');

console.log(`Transfer events found: ${transferLogs.length}`);
transferLogs.forEach(log => {
  console.log(`  From: ${log.args.from} → To: ${log.args.to}`);
  console.log(`  Amount: ${log.args.value.toString()} wei`);
});

console.log(`Approval events found: ${approvalLogs.length}`);
approvalLogs.forEach(log => {
  console.log(`  Owner: ${log.args.owner} → Spender: ${log.args.spender}`);
  console.log(`  Amount: ${log.args.value.toString()}`);
});

// Example 3: Process multiple receipts at once
console.log('\n\nExample 3: Process Multiple Receipts');
const multipleReceipts = [sampleReceipt, sampleReceipt]; // Simulate multiple txs
const allLogs = codec.decodeMultipleReceipts(multipleReceipts);

console.log(`Processed ${multipleReceipts.length} receipts`);
console.log(`Total decoded logs: ${allLogs.length}`);

// Group by event type
const eventCounts = {};
allLogs.forEach(log => {
  eventCounts[log.name] = (eventCounts[log.name] || 0) + 1;
});

console.log('Event summary:');
Object.entries(eventCounts).forEach(([event, count]) => {
  console.log(`  ${event}: ${count} events`);
});

// Example 4: Get all event topics this codec can handle
console.log('\n\nExample 4: Known Event Topics');
const knownTopics = codec.getKnownEventTopics();
console.log('This codec can decode events with these topics:');
knownTopics.forEach(topic => {
  // Find event name for this topic
  for (const [key, event] of codec.events.entries()) {
    if (key === topic) {
      console.log(`  ${topic} (${codec.events.get(event.name || 'Unknown').name})`);
      break;
    }
  }
});

// Example 5: Real-world usage pattern
console.log('\n\nExample 5: Real-world Usage Pattern');

function processTransactionResults(receipts, codec) {
  const results = {
    totalLogs: 0,
    decodedLogs: 0,
    events: {}
  };
  
  for (const receipt of receipts) {
    results.totalLogs += receipt.logs?.length || 0;
    
    const decoded = codec.decodeReceiptLogs(receipt);
    results.decodedLogs += decoded.length;
    
    // Count events by type
    decoded.forEach(log => {
      results.events[log.name] = (results.events[log.name] || 0) + 1;
    });
  }
  
  return results;
}

const results = processTransactionResults([sampleReceipt], codec);
console.log('Processing results:');
console.log(`  Total logs in receipts: ${results.totalLogs}`);
console.log(`  Successfully decoded: ${results.decodedLogs}`);
console.log(`  Decode rate: ${((results.decodedLogs / results.totalLogs) * 100).toFixed(1)}%`);
console.log('  Event breakdown:', results.events);

console.log('\n✅ All examples completed!');
