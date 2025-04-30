const Joi = require('joi');
const apiTemplate = require('../data/estadoRedDetalle.php.json');

// Unified schema that handles both API and internal formats
const metroSchema = Joi.object().pattern(
  Joi.string().pattern(/^l[1-6a]?$/i), // Matches L1, L2, etc. case insensitive
  Joi.object({
    // API format fields
    estado: Joi.string().valid('0', '1', '2', '3', '4', '5'),
    mensaje: Joi.string().allow(''),
    mensaje_app: Joi.string(),
    estaciones: Joi.array().items(
      Joi.object({
        nombre: Joi.string().required(),
        codigo: Joi.string().required(),
        estado: Joi.string().valid('0', '1', '2', '3', '4', '5'),
        combinacion: Joi.string().allow(''),
        descripcion: Joi.string(),
        descripcion_app: Joi.string(),
        mensaje: Joi.string().allow('')
      })
    ),
    
    // Internal format fields
    status: Joi.string().valid('0', '1', '2', '3', '4', '5'),
    message: Joi.string().allow(''),
    appMessage: Joi.string(),
    stations: Joi.array().items(
      Joi.object({
        name: Joi.string(),
        code: Joi.string(),
        status: Joi.string().valid('0', '1', '2', '3', '4', '5'),
        transfer: Joi.string().allow(''),
        description: Joi.string(),
        appDescription: Joi.string()
      })
    )
  }).or('estado', 'status') // Require either API or internal format fields
  .xor('estaciones', 'stations') // Only one of these should exist
);

exports.validateAgainstTemplate = (data) => {
  const { error, value } = metroSchema.validate(data, { 
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: true // Temporarily allow unknown fields
  });

  if (error) {
    // Filter out "not allowed" errors for fields that exist in alternate format
    const relevantErrors = error.details.filter(d => {
      if (d.type === 'object.unknown') return false;
      if (d.message.includes('not allowed')) {
        const path = d.path.join('.');
        // Allow fields from the other format
        if (path.includes('status') || path.includes('message') || path.includes('stations')) {
          return !(path in data && 
                 (path.replace('status','estado') in data || 
                  path.replace('message','mensaje') in data));
        }
      }
      return true;
    });

    if (relevantErrors.length > 0) {
      const messages = relevantErrors.map(d => `${d.path.join('.')}: ${d.message}`);
      throw new Error(`Validation failed:\n${messages.join('\n')}`);
    }
  }

  return value;
};

// Additional validator for transformed data
exports.validateTransformedData = (data) => {
  const schema = Joi.object().pattern(
    Joi.string().pattern(/^l[1-6a]?$/i),
    Joi.object({
      status: Joi.string().valid('0', '1', '2', '3', '4', '5').required(),
      message: Joi.string().allow('').required(),
      appMessage: Joi.string().required(),
      stations: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          code: Joi.string().required(),
          status: Joi.string().valid('0', '1', '2', '3', '4', '5').required(),
          transfer: Joi.string().allow(''),
          description: Joi.string().required(),
          appDescription: Joi.string().required()
        })
      ).required()
    })
  );

  const { error } = schema.validate(data, { abortEarly: false });
  if (error) {
    throw new Error(`Transformed data validation failed: ${
      error.details.map(d => d.message).join('; ')
    }`);
  }
};