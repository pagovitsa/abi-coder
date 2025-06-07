const { keccak256, toUtf8Bytes } = require('ethers');

// Parse and normalize ABI
function parseABI(abi) {
  if (typeof abi === 'string') {
    return JSON.parse(abi);
  }
  return abi;
}

// Get function selector (first 4 bytes of keccak256 hash)
function getFunctionSelector(func) {
  const signature = getFunctionSignature(func);
  const hash = keccak256(toUtf8Bytes(signature));
  return hash.slice(0, 10); // 0x + 8 hex chars = 4 bytes
}

// Get event selector (full keccak256 hash)
function getEventSelector(event) {
  const signature = getEventSignature(event);
  return keccak256(toUtf8Bytes(signature));
}

// Generate function signature string
function getFunctionSignature(func) {
  const inputs = func.inputs.map(input => getCanonicalType(input)).join(',');
  return `${func.name}(${inputs})`;
}

// Generate event signature string  
function getEventSignature(event) {
  const inputs = event.inputs.map(input => getCanonicalType(input)).join(',');
  return `${event.name}(${inputs})`;
}

// Get canonical type string for ABI encoding
function getCanonicalType(param) {
  let type = param.type;
  
  // Handle arrays
  if (param.type.includes('[')) {
    const baseType = param.type.split('[')[0];
    const arrayPart = param.type.substring(baseType.length);
    return getBaseCanonicalType(baseType) + arrayPart;
  }
  
  return getBaseCanonicalType(type);
}

function getBaseCanonicalType(type) {
  // Handle tuple types (structs)
  if (type === 'tuple') {
    return 'tuple';
  }
  
  // Normalize integer types
  if (type === 'uint') return 'uint256';
  if (type === 'int') return 'int256';
  if (type === 'bytes' && !type.includes('bytes')) return 'bytes';
  
  return type;
}

// Fast hex string utilities
function hexToBuffer(hex) {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  return Buffer.from(hex, 'hex');
}

function bufferToHex(buffer) {
  return '0x' + buffer.toString('hex');
}

// Pad buffer to 32 bytes (left padding for numbers, right for bytes)
function padLeft(buffer, length = 32) {
  if (buffer.length >= length) return buffer;
  const padding = Buffer.alloc(length - buffer.length);
  return Buffer.concat([padding, buffer]);
}

function padRight(buffer, length = 32) {
  if (buffer.length >= length) return buffer;
  const padding = Buffer.alloc(length - buffer.length);
  return Buffer.concat([buffer, padding]);
}

// Check if string is valid hex
function isHex(str) {
  return /^0x[0-9a-fA-F]*$/.test(str);
}

// Fast bigint utilities
function toBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      return BigInt(value);
    }
    return BigInt(value);
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  throw new Error(`Cannot convert to BigInt: ${value}`);
}

module.exports = {
  parseABI,
  getFunctionSelector,
  getEventSelector,
  getFunctionSignature,
  getEventSignature,
  getCanonicalType,
  hexToBuffer,
  bufferToHex,
  padLeft,
  padRight,
  isHex,
  toBigInt
};
