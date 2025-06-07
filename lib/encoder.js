const { hexToBuffer, bufferToHex, padLeft, padRight, toBigInt, isHex } = require('./utils');

class Encoder {
  constructor() {
    // Cache for commonly used values
    this.cache = new Map();
  }

  // Main encoding function
  encodeParameters(types, values) {
    if (types.length !== values.length) {
      throw new Error(`Type/value count mismatch: ${types.length} types, ${values.length} values`);
    }

    const staticParts = [];
    const dynamicParts = [];
    let dynamicOffset = types.length * 32; // Each type takes 32 bytes in static part

    for (let i = 0; i < types.length; i++) {
      const typeStr = typeof types[i] === 'string' ? types[i] : types[i].type;
      const encoded = this.encodeParameter(typeStr, values[i]);
      
      if (this.isDynamicType(typeStr)) {
        // Dynamic type: store offset in static part, data in dynamic part
        staticParts.push(this.encodeUint(dynamicOffset));
        dynamicParts.push(encoded);
        dynamicOffset += encoded.length;
      } else {
        // Static type: store directly in static part
        staticParts.push(encoded);
      }
    }

    // Combine static and dynamic parts
    const result = Buffer.concat([...staticParts, ...dynamicParts]);
    return bufferToHex(result);
  }

  // Encode single parameter
  encodeParameter(type, value) {
    // Handle arrays first
    if (type.includes('[')) {
      return this.encodeArray(type, value);
    }

    // Handle tuple (struct)
    if (type.startsWith('tuple')) {
      return this.encodeTuple(type, value);
    }

    // Handle basic types
    switch (type) {
      case 'bool':
        return this.encodeBool(value);
      case 'address':
        return this.encodeAddress(value);
      case 'bytes':
        return this.encodeBytes(value);
      case 'string':
        return this.encodeString(value);
      default:
        if (type.startsWith('uint')) {
          return this.encodeUint(value, parseInt(type.slice(4)) || 256);
        }
        if (type.startsWith('int')) {
          return this.encodeInt(value, parseInt(type.slice(3)) || 256);
        }
        if (type.startsWith('bytes') && type.length > 5) {
          const size = parseInt(type.slice(5));
          return this.encodeFixedBytes(value, size);
        }
        throw new Error(`Unsupported type: ${type}`);
    }
  }

  // Type encoders
  encodeBool(value) {
    return padLeft(Buffer.from([value ? 1 : 0]));
  }

  encodeUint(value, bits = 256) {
    const bigIntValue = toBigInt(value);
    if (bigIntValue < 0n) {
      throw new Error(`Negative value for uint${bits}: ${value}`);
    }
    
    const maxValue = (1n << BigInt(bits)) - 1n;
    if (bigIntValue > maxValue) {
      throw new Error(`Value too large for uint${bits}: ${value}`);
    }

    const hex = bigIntValue.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
  }

  encodeInt(value, bits = 256) {
    const bigIntValue = toBigInt(value);
    const minValue = -(1n << (BigInt(bits) - 1n));
    const maxValue = (1n << (BigInt(bits) - 1n)) - 1n;
    
    if (bigIntValue < minValue || bigIntValue > maxValue) {
      throw new Error(`Value out of range for int${bits}: ${value}`);
    }

    let hex;
    if (bigIntValue >= 0n) {
      hex = bigIntValue.toString(16).padStart(64, '0');
    } else {
      // Two's complement for negative numbers
      const positive = (1n << 256n) + bigIntValue;
      hex = positive.toString(16).padStart(64, '0');
    }
    
    return Buffer.from(hex, 'hex');
  }

  encodeAddress(value) {
    if (typeof value !== 'string' || !value.startsWith('0x') || value.length !== 42) {
      throw new Error(`Invalid address: ${value}`);
    }
    
    const addressBuffer = hexToBuffer(value);
    return padLeft(addressBuffer);
  }

  encodeFixedBytes(value, size) {
    let buffer;
    if (typeof value === 'string') {
      if (isHex(value)) {
        buffer = hexToBuffer(value);
      } else {
        buffer = Buffer.from(value, 'utf8');
      }
    } else if (Buffer.isBuffer(value)) {
      buffer = value;
    } else {
      throw new Error(`Invalid bytes value: ${value}`);
    }

    if (buffer.length > size) {
      throw new Error(`Bytes too long for bytes${size}: ${buffer.length} > ${size}`);
    }

    return padRight(buffer);
  }

  encodeBytes(value) {
    let buffer;
    if (typeof value === 'string') {
      if (isHex(value)) {
        buffer = hexToBuffer(value);
      } else {
        buffer = Buffer.from(value, 'utf8');
      }
    } else if (Buffer.isBuffer(value)) {
      buffer = value;
    } else {
      throw new Error(`Invalid bytes value: ${value}`);
    }

    // Dynamic bytes: length + data
    const length = this.encodeUint(buffer.length);
    const paddedData = padRight(buffer, Math.ceil(buffer.length / 32) * 32);
    return Buffer.concat([length, paddedData]);
  }

  encodeString(value) {
    if (typeof value !== 'string') {
      throw new Error(`Expected string, got: ${typeof value}`);
    }
    
    const buffer = Buffer.from(value, 'utf8');
    return this.encodeBytes(buffer);
  }

  encodeArray(type, values) {
    if (!Array.isArray(values)) {
      throw new Error(`Expected array for type ${type}, got: ${typeof values}`);
    }

    // Parse array type: e.g., "uint256[]" or "uint256[5]"
    const bracketIndex = type.indexOf('[');
    const baseType = type.slice(0, bracketIndex);
    const arraySpec = type.slice(bracketIndex);
    
    const isFixedSize = arraySpec !== '[]';
    const fixedSize = isFixedSize ? parseInt(arraySpec.slice(1, -1)) : null;

    if (isFixedSize && values.length !== fixedSize) {
      throw new Error(`Array length mismatch: expected ${fixedSize}, got ${values.length}`);
    }

    // Encode array elements
    const encodedElements = values.map(value => this.encodeParameter(baseType, value));

    if (this.isDynamicType(baseType)) {
      // Dynamic element type
      let result = [];
      
      if (!isFixedSize) {
        // Dynamic array: include length
        result.push(this.encodeUint(values.length));
      }

      // Calculate offsets for dynamic elements
      let offset = values.length * 32;
      const staticParts = [];
      const dynamicParts = [];

      for (const encoded of encodedElements) {
        staticParts.push(this.encodeUint(offset));
        dynamicParts.push(encoded);
        offset += encoded.length;
      }

      result.push(...staticParts, ...dynamicParts);
      return Buffer.concat(result);
    } else {
      // Static element type
      let result = [];
      
      if (!isFixedSize) {
        // Dynamic array: include length
        result.push(this.encodeUint(values.length));
      }

      result.push(...encodedElements);
      return Buffer.concat(result);
    }
  }

  encodeTuple(type, value) {
    // TODO: Implement tuple encoding for structs
    // This would require parsing the tuple type definition
    throw new Error('Tuple encoding not yet implemented');
  }

  // Check if type is dynamic (variable length)
  isDynamicType(type) {
    if (type === 'string' || type === 'bytes') return true;
    if (type.includes('[]')) return true;
    if (type.startsWith('tuple')) return true; // Assume tuples can be dynamic
    return false;
  }
}

module.exports = Encoder;
