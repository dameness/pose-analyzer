import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  BCRYPT_ROUNDS: Joi.number().integer().positive().default(10),
  PORT: Joi.number().integer().positive().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
});
