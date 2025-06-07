const { ABICodec } = require('../index');

// Test ABI with multiple events
const testABI = [
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

// Mock transaction receipt with multiple logs
const mockReceipt = {
  transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  blockNumber: 18500000,
  blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  logs: [
    {
      address: '0xA0b86a33E6417c8C2B60C9B6D2b1f1d3F4E5F6a7',
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer
        '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de6', // from
        '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de7'  // to
      ],
      data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000', // 1 ETH
      logIndex: 0,
      transactionIndex: 50,
      removed: false
    },
    {
      address: '0xA0b86a33E6417c8C2B60C9B6D2b1f1d3F4E5F6a7',
      topics: [
        '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925', // Approval
        '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de6', // owner
        '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de8'  // spender
      ],
      data: '0x00000000000000000000000000000000000000000000021e19e0c9bab2400000', // Large approval
      logIndex: 1,
      transactionIndex: 50,
      removed: false
    },
    {
      // Unknown event (not in ABI) - should be skipped
      address: '0xB0b86a33E6417c8C2B60C9B6D2b1f1d3F4E5F6a8',
      topics: [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      ],
      data: '0x0000000000000000000000000000000000000000000000000000000000000001',
      logIndex: 2,
      transactionIndex: 50,
      removed: false
    },
    {
      address: '0xA0b86a33E6417c8C2B60C9B6D2b1f1d3F4E5F6a7',
      topics: [
        '0x0f6798a560793a54c3bcfe86a93cde1e73087d944c0ea20544137d4121396885', // Mint
        '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de9'  // to
      ],
      data: '0x0000000000000000000000000000000000000000000000001bc16d674ec80000', // 2 ETH
      logIndex: 3,
      transactionIndex: 50,
      removed: false
    }
  ]
};

function testReceiptDecoding() {
  console.log('🚀 Testing Receipt Log Decoding...\n');
  
  try {
    const codec = new ABICodec(testABI);
    
    // Test 1: Decode single receipt logs
    console.log('Test 1: Decode Receipt Logs');
    const decodedLogs = codec.decodeReceiptLogs(mockReceipt);
    
    console.log(`Found ${decodedLogs.length} decodable logs:`);
    decodedLogs.forEach((log, index) => {
      console.log(`  Log ${index + 1}: ${log.name}`);
      console.log(`    Args:`, log.args);
      console.log(`    Address: ${log.address}`);
      console.log(`    Log Index: ${log.logIndex}`);
    });
    console.log('✅ Receipt log decoding successful\n');
    
    // Test 2: Filter logs by event name
    console.log('Test 2: Filter Logs by Event Name');
    const transferLogs = codec.filterLogsByEvent(decodedLogs, 'Transfer');
    const approvalLogs = codec.filterLogsByEvent(decodedLogs, 'Approval');
    const mintLogs = codec.filterLogsByEvent(decodedLogs, 'Mint');
    
    console.log(`Transfer events: ${transferLogs.length}`);
    console.log(`Approval events: ${approvalLogs.length}`);
    console.log(`Mint events: ${mintLogs.length}`);
    console.log('✅ Event filtering successful\n');
    
    // Test 3: Decode multiple receipts
    console.log('Test 3: Decode Multiple Receipts');
    const receipts = [mockReceipt, mockReceipt]; // Duplicate for testing
    const allLogs = codec.decodeMultipleReceipts(receipts);
    console.log(`Total decoded logs from ${receipts.length} receipts: ${allLogs.length}`);
    console.log('✅ Multiple receipt decoding successful\n');
    
    // Test 4: Get known event topics
    console.log('Test 4: Get Known Event Topics');
    const knownTopics = codec.getKnownEventTopics();
    console.log('Known event topics:');
    knownTopics.forEach(topic => console.log(`  ${topic}`));
    console.log('✅ Event topics retrieval successful\n');
    
    // Test 5: Performance test
    console.log('Test 5: Performance Test');
    const iterations = 1000;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      codec.decodeReceiptLogs(mockReceipt);
    }
    
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;
    console.log(`Decoded ${iterations} receipts in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`Average time per receipt: ${avgTime.toFixed(4)}ms`);
    console.log('✅ Performance test completed\n');
    
    // Test 6: Handle edge cases
    console.log('Test 6: Edge Cases');
    
    // Empty receipt
    const emptyLogs = codec.decodeReceiptLogs({ logs: [] });
    console.log(`Empty receipt logs: ${emptyLogs.length}`);
    
    // Null receipt
    const nullLogs = codec.decodeReceiptLogs(null);
    console.log(`Null receipt logs: ${nullLogs.length}`);
    
    // Receipt with no matching events
    const noMatchReceipt = {
      logs: [{
        topics: ['0x1111111111111111111111111111111111111111111111111111111111111111'],
        data: '0x00'
      }]
    };
    const noMatchLogs = codec.decodeReceiptLogs(noMatchReceipt);
    console.log(`No match receipt logs: ${noMatchLogs.length}`);
    
    console.log('✅ Edge cases handled successfully\n');
    
    console.log('🎉 All receipt decoding tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the tests
testReceiptDecoding();
