const { ABICodec } = require('../index');

// Test ABI for ERC20 token
const erc20ABI = [
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {"name": "to", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [
      {"name": "success", "type": "bool"}
    ]
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {"name": "account", "type": "address"}
    ],
    "outputs": [
      {"name": "balance", "type": "uint256"}
    ]
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      {"name": "from", "type": "address", "indexed": true},
      {"name": "to", "type": "address", "indexed": true},
      {"name": "value", "type": "uint256", "indexed": false}
    ]
  }
];

function runTests() {
  console.log('🚀 Starting ABI Codec Tests...\n');
  
  try {
    const codec = new ABICodec(erc20ABI);
    
    // Test 1: Function encoding
    console.log('Test 1: Function Encoding');
    const transferData = codec.encodeFunction('transfer', [
      '0x742d35Cc6634C0532925a3b8D8e9eED89B7A6de6',
      BigInt('1000000000000000000') // 1 ETH in wei
    ]);
    console.log('Transfer calldata:', transferData);
    console.log('✅ Function encoding successful\n');
    
    // Test 2: Function decoding
    console.log('Test 2: Function Decoding');
    const decodedParams = codec.decodeFunction('transfer', transferData);
    console.log('Decoded params:', decodedParams);
    console.log('✅ Function decoding successful\n');
    
    // Test 3: Function result decoding
    console.log('Test 3: Function Result Decoding');
    const resultData = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const decodedResult = codec.decodeFunctionResult('transfer', resultData);
    console.log('Decoded result:', decodedResult);
    console.log('✅ Function result decoding successful\n');
    
    // Test 4: Event log decoding
    console.log('Test 4: Event Log Decoding');
    const logData = '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000';
    const topics = [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de6',
      '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de7'
    ];
    
    const decodedLog = codec.decodeLog(logData, topics, 'Transfer');
    console.log('Decoded log:', decodedLog);
    console.log('✅ Event log decoding successful\n');
    
    // Test 5: Performance test
    console.log('Test 5: Performance Test');
    const iterations = 10000;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      codec.encodeFunction('transfer', [
        '0x742d35Cc6634C0532925a3b8D8e9eED89B7A6de6',
        BigInt(i)
      ]);
    }
    
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;
    console.log(`Encoded ${iterations} function calls in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`Average time per encoding: ${avgTime.toFixed(4)}ms`);
    console.log('✅ Performance test completed\n');
    
    // Test 6: Receipt log decoding
    console.log('Test 6: Receipt Log Decoding');
    const mockReceipt = {
      logs: [
        {
          address: '0xA0b86a33E6417c8C2B60C9B6D2b1f1d3F4E5F6a7',
          topics: [
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
            '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de6',
            '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de7'
          ],
          data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000',
          logIndex: 0
        }
      ]
    };
    
    const receiptLogs = codec.decodeReceiptLogs(mockReceipt);
    console.log(`Decoded ${receiptLogs.length} logs from receipt`);
    console.log('Receipt log:', receiptLogs[0]);
    console.log('✅ Receipt log decoding successful\n');
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the tests
runTests();
