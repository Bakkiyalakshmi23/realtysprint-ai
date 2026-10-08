'use strict';

const { getSchema } = require('./schemas');

function validateStructuredOutput(name, value) {
  const schema = getSchema(name);
  const errors = [];

  function visit(node, spec, path) {
    if (spec.type === 'object') {
      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        errors.push(`${path} must be an object.`);
        return;
      }
      for (const key of spec.required || []) {
        if (!Object.hasOwn(node, key)) errors.push(`${path}.${key} is required.`);
      }
      for (const key of Object.keys(node)) {
        if (!Object.hasOwn(spec.properties, key)) errors.push(`${path}.${key} is not allowed.`);
      }
      for (const [key, childSpec] of Object.entries(spec.properties)) {
        if (Object.hasOwn(node, key)) visit(node[key], childSpec, `${path}.${key}`);
      }
      return;
    }
    if (spec.type === 'array') {
      if (!Array.isArray(node) || node.length > 50) {
        errors.push(`${path} must be an array with at most 50 items.`);
        return;
      }
      node.forEach((entry, index) => visit(entry, spec.items, `${path}[${index}]`));
      return;
    }
    const acceptedTypes = Array.isArray(spec.type) ? spec.type : [spec.type];
    const matches = acceptedTypes.some(type => type === 'null' ? node === null : type === 'integer' ? Number.isInteger(node) : typeof node === type);
    if (!matches) {
      errors.push(`${path} has an invalid type.`);
      return;
    }
    if (typeof node === 'string' && node.length > 4000) errors.push(`${path} exceeds 4000 characters.`);
    if (typeof node === 'number' && !Number.isFinite(node)) errors.push(`${path} must be finite.`);
    if (spec.minimum !== undefined && node < spec.minimum) errors.push(`${path} is below its minimum.`);
    if (spec.maximum !== undefined && node > spec.maximum) errors.push(`${path} is above its maximum.`);
  }

  visit(value, schema, 'output');
  if (errors.length) {
    const error = new Error(`Structured AI output failed validation: ${errors.slice(0, 5).join(' ')}`);
    error.name = 'StructuredOutputValidationError';
    throw error;
  }
  return value;
}

module.exports = { validateStructuredOutput };
