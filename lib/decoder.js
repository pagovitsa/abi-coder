const { hexToBuffer, bufferToHex, padLeft, padRight, toBigInt, isHex } = require('./utils');

class Decoder {
  constructor() {
    // Cache for commonly decoded values
    this.cache = new Map();
  }

  // Main decoding function for parameters
  decodeParameters(types, data) {
    if (!data || data === '0x') {
      return types.length === 0 ? [] : new Array(types.length).fill(null);
    }

    const buffer = hexToBuffer(data);
    const results = [];
    let staticOffset = 0;

    // First pass: handle static types and collect dynamic offsets
    for (let i = 0; i < types.length; i++) {
      const typeStr = typeof types[i] === 'string' ? types[i] : types[i].type;
      
      if (this.isDynamicType(typeStr)) {
        // Dynamic type: read offset from static section
        const offsetResult = this.decodeUint(buffer, staticOffset);
        const dataOffset = Number(offsetResult.value);
        const { value } = this.decodeParameter(typeStr, buffer, dataOffset);
        results.push(value);
      } else {
        // Static type: decode directly
        const { value } = this.decodeParameter(typeStr, buffer, staticOffset);
        results.push(value);
      }
      staticOffset += 32; // Each parameter takes 32 bytes in static section
    }

    return results;
  }

  // Decode single parameter
  decodeParameter(type, buffer, offset) {
    // Handle arrays first
    if (type.includes('[')) {
      return this.decodeArray(type, buffer, offset);
    }

    // Handle tuple (struct)
    if (type.startsWith('tuple')) {
      return this.decodeTuple(type, buffer, offset);
    }

    // Handle basic types
    switch (type) {
      case 'bool':
        return this.decodeBool(buffer, offset);
      case 'address':
        return this.decodeAddress(buffer, offset);
      case 'bytes':
        return this.decodeBytes(buffer, offset);
      case 'string':
        return this.decodeString(buffer, offset);
      default:
        if (type.startsWith('uint')) {
          const bits = parseInt(type.slice(4)) || 256;
          return this.decodeUint(buffer, offset, bits);
        }
        if (type.startsWith('int')) {
          const bits = parseInt(type.slice(3)) || 256;
          return this.decodeInt(buffer, offset, bits);
        }
        if (type.startsWith('bytes') && type.length > 5) {
          const size = parseInt(type.slice(5));
          return this.decodeFixedBytes(buffer, offset, size);
        }
        throw new Error(`Unsupported type: ${type}`);
    }
  }

  // Type decoders
  decodeBool(buffer, offset) {
    const value = buffer.readUInt8(offset + 31) !== 0;
    return { value, nextOffset: offset + 32 };
  }

  decodeUint(buffer, offset, bits = 256) {
    const slice = buffer.slice(offset, offset + 32);
    let value = 0n;
    
    // Fast path for common sizes
    if (bits <= 64) {
      // Use readBigUInt64BE for performance when possible
      const high = buffer.readUInt32BE(offset + 24);
      const low = buffer.readUInt32BE(offset + 28);
      value = (BigInt(high) << 32n) | BigInt(low);
    } else {
      // General case: convert full 32-byte slice
      const hex = slice.toString('hex');
      value = BigInt('0x' + hex);
    }

    // Validate range
    const maxValue = (1n << BigInt(bits)) - 1n;
    if (value > maxValue) {
      throw new Error(`Value too large for uint${bits}: ${value}`);
    }

    return { value, nextOffset: offset + 32 };
  }

  decodeInt(buffer, offset, bits = 256) {
    const slice = buffer.slice(offset, offset + 32);
    const hex = slice.toString('hex');
    let value = BigInt('0x' + hex);

    // Handle two's complement for negative values
    const signBit = 1n << (BigInt(bits) - 1n);
    if (value >= signBit) {
      const maxUint = 1n << BigInt(bits);
      value = value - maxUint;
    }

    // Validate range
    const minValue = -(1n << (BigInt(bits) - 1n));
    const maxValue = (1n << (BigInt(bits) - 1n)) - 1n;
    if (value < minValue || value > maxValue) {
      throw new Error(`Value out of range for int${bits}: ${value}`);
    }

    return { value, nextOffset: offset + 32 };
  }

  decodeAddress(buffer, offset) {
    // Address is in the last 20 bytes of the 32-byte word
    const addressBytes = buffer.slice(offset + 12, offset + 32);
    const value = '0x' + addressBytes.toString('hex');
    return { value, nextOffset: offset + 32 };
  }

  decodeFixedBytes(buffer, offset, size) {
    const slice = buffer.slice(offset, offset + size);
    const value = '0x' + slice.toString('hex');
    return { value, nextOffset: offset + 32 };
  }

  decodeBytes(buffer, offset) {
    // For dynamic bytes, we expect the data to be stored with length prefix
    return this.decodeBytesAt(buffer, offset);
  }

  decodeBytesAt(buffer, offset) {
    // Read length first
    const length = Number(this.decodeUint(buffer, offset).value);
    const dataOffset = offset + 32;
    
    // Read the actual bytes
    const value = '0x' + buffer.slice(dataOffset, dataOffset + length).toString('hex');
    
    // Calculate next offset (data is padded to 32-byte boundary)
    const paddedLength = Math.ceil(length / 32) * 32;
    const nextOffset = dataOffset + paddedLength;
    
    return { value, nextOffset };
  }

  decodeString(buffer, offset) {
    // String is encoded like bytes but interpreted as UTF-8
    const bytesResult = this.decodeBytes(buffer, offset);
    const hex = bytesResult.value.slice(2); // Remove 0x
    const value = Buffer.from(hex, 'hex').toString('utf8');
    
    return { value, nextOffset: bytesResult.nextOffset };
  }

  decodeArray(type, buffer, offset) {
    // Parse array type
    const bracketIndex = type.indexOf('[');
    const baseType = type.slice(0, bracketIndex);
    const arraySpec = type.slice(bracketIndex);
    
    const isFixedSize = arraySpec !== '[]';
    const fixedSize = isFixedSize ? parseInt(arraySpec.slice(1, -1)) : null;

    let currentOffset = offset;
    let arrayLength;

    if (this.isDynamicType(type)) {
      // Dynamic array: read offset first
      const dataOffset = Number(this.decodeUint(buffer, offset).value);
      currentOffset = dataOffset;
    }

    if (isFixedSize) {
      arrayLength = fixedSize;
    } else {
      // Dynamic array: read length
      const lengthResult = this.decodeUint(buffer, currentOffset);
      arrayLength = Number(lengthResult.value);
      currentOffset = lengthResult.nextOffset;
    }

    const results = [];
    
    if (this.isDynamicType(baseType)) {
      // Dynamic element type: elements are stored with offsets
      const staticOffset = currentOffset;
      
      for (let i = 0; i < arrayLength; i++) {
        const elementOffset = Number(this.decodeUint(buffer, staticOffset + i * 32).value);
        const absoluteOffset = (this.isDynamicType(type) ? 
          Math.floor(offset / 32) * 32 : 0) + elementOffset;
        const { value } = this.decodeParameter(baseType, buffer, absoluteOffset);
        results.push(value);
      }
      
      // Calculate next offset (this is complex for dynamic arrays)
      const nextOffset = currentOffset + arrayLength * 32;
      return { value: results, nextOffset };
    } else {
      // Static element type: elements are stored sequentially
      for (let i = 0; i < arrayLength; i++) {
        const { value, nextOffset } = this.decodeParameter(baseType, buffer, currentOffset);
        results.push(value);
        currentOffset = nextOffset;
      }
      
      return { value: results, nextOffset: currentOffset };
    }
  }

  decodeTuple(type, buffer, offset) {
    // TODO: Implement tuple decoding for structs
    // This would require parsing the tuple type definition
    throw new Error('Tuple decoding not yet implemented');
  }

  // Decode event log
  decodeLog(eventAbi, data, topics) {
    const result = { name: eventAbi.name, args: {} };
    
    // Separate indexed and non-indexed parameters
    const indexedParams = eventAbi.inputs.filter(input => input.indexed);
    const nonIndexedParams = eventAbi.inputs.filter(input => !input.indexed);
    
    // Decode indexed parameters from topics (skip topic[0] which is event signature)
    for (let i = 0; i < indexedParams.length; i++) {
      const param = indexedParams[i];
      const topic = topics[i + 1];
      
      if (!topic) continue;
      
      // For dynamic types, topics contain the hash, not the actual value
      if (this.isDynamicType(param.type)) {
        result.args[param.name] = topic; // Store the hash
      } else {
        // Decode the topic as the actual value
        const topicBuffer = hexToBuffer(topic);
        const { value } = this.decodeParameter(param.type, topicBuffer, 0);
        result.args[param.name] = value;
      }
    }
    
    // Decode non-indexed parameters from data
    if (nonIndexedParams.length > 0 && data && data !== '0x') {
      const types = nonIndexedParams.map(param => param.type);
      const decodedData = this.decodeParameters(types, data);
      
      for (let i = 0; i < nonIndexedParams.length; i++) {
        result.args[nonIndexedParams[i].name] = decodedData[i];
      }
    }
    
    return result;
  }

  // Check if type is dynamic (variable length)
  isDynamicType(type) {
    if (type === 'string' || type === 'bytes') return true;
    if (type.includes('[]')) return true;
    if (type.startsWith('tuple')) return true;
    return false;
  }
}

module.exports = Decoder;
