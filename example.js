const { ABICodec } = require('./index');

// Example usage of the high-performance ABI codec

// Sample ABI (you can use any contract ABI)
const contractABI = [
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {"name": "to", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"name": "success", "type": "bool"}]
  },
  {
    "type": "function", 
    "name": "approve",
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"name": "success", "type": "bool"}]
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

// Initialize the codec
const codec = new ABICodec(contractABI);

console.log('🚀 ABI Codec Usage Examples\n');

// 1. Encode function calls
console.log('1. Encoding function calls:');
const transferCalldata = codec.encodeFunction('transfer', [
  '0x742d35Cc6634C0532925a3b8D8e9eED89B7A6de6',  // to address
  BigInt('1000000000000000000')                      // 1 ETH in wei
]);
console.log('Transfer calldata:', transferCalldata);

const approveCalldata = codec.encodeFunction('approve', [
  '0x1234567890123456789012345678901234567890',
  BigInt('999999999999999999999999999')  // Large approval
]);
console.log('Approve calldata:', approveCalldata);

// 2. Decode function calls
console.log('\n2. Decoding function calls:');
const decodedTransfer = codec.decodeFunction('transfer', transferCalldata);
console.log('Decoded transfer:', decodedTransfer);

// 3. Decode function results 
console.log('\n3. Decoding function results:');
const successResult = '0x0000000000000000000000000000000000000000000000000000000000000001';
const decoded = codec.decodeFunctionResult('transfer', successResult);
console.log('Transfer result:', decoded); // [true]

// 4. Decode event logs
console.log('\n4. Decoding event logs:');
const eventLog = {
  data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000',
  topics: [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer event signature
    '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de6', // from (indexed)
    '0x000000000000000000000000742d35cc6634c0532925a3b8d8e9eed89b7a6de7'  // to (indexed)
  ]
};

const decodedLog = codec.decodeLog(eventLog.data, eventLog.topics, 'Transfer');
console.log('Decoded event:', decodedLog);

// 5. Get function/event selectors
console.log('\n5. Getting selectors:');
console.log('Transfer function selector:', codec.getFunctionSelector('transfer'));
console.log('Transfer event selector:', codec.getEventSelector('Transfer'));

console.log('\n✅ All examples completed!');
