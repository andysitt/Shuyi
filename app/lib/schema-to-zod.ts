import { z } from 'zod';
import { Schema, Type } from '@google/genai';

/**
 * Converts a Google AI Schema object to a Zod schema.
 * @param schema The Google AI Schema object.
 * @returns A Zod schema.
 */
export function schemaToZod(schema: Schema): z.ZodTypeAny {
  let zodSchema: z.ZodTypeAny;

  if (schema.enum) {
    // Zod enums require at least one value.
    if (schema.enum.length === 0) {
      return z.any().refine(() => false, { message: 'Enum cannot be empty' });
    }
    zodSchema = z.enum(schema.enum as [string, ...string[]]);
  } else {
    switch (schema.type) {
      case Type.STRING:
        zodSchema = z.string();
        if (schema.minLength) {
          zodSchema = (zodSchema as z.ZodString).min(
            parseInt(schema.minLength, 10),
          );
        }
        if (schema.maxLength) {
          zodSchema = (zodSchema as z.ZodString).max(
            parseInt(schema.maxLength, 10),
          );
        }
        if (schema.pattern) {
          zodSchema = (zodSchema as z.ZodString).regex(
            new RegExp(schema.pattern),
          );
        }
        break;
      case Type.NUMBER:
        zodSchema = z.number();
        if (schema.minimum) {
          zodSchema = (zodSchema as z.ZodNumber).min(schema.minimum);
        }
        if (schema.maximum) {
          zodSchema = (zodSchema as z.ZodNumber).max(schema.maximum);
        }
        break;
      case Type.INTEGER:
        zodSchema = z.number().int();
        if (schema.minimum) {
          zodSchema = (zodSchema as z.ZodNumber).min(schema.minimum);
        }
        if (schema.maximum) {
          zodSchema = (zodSchema as z.ZodNumber).max(schema.maximum);
        }
        break;
      case Type.BOOLEAN:
        zodSchema = z.boolean();
        break;
      case Type.ARRAY:
        if (schema.items) {
          zodSchema = z.array(schemaToZod(schema.items));
          if (schema.minItems) {
            zodSchema = (zodSchema as z.ZodArray<any>).min(
              parseInt(schema.minItems, 10),
            );
          }
          if (schema.maxItems) {
            zodSchema = (zodSchema as z.ZodArray<any>).max(
              parseInt(schema.maxItems, 10),
            );
          }
        } else {
          zodSchema = z.array(z.any());
        }
        break;
      case Type.OBJECT:
        if (schema.properties) {
          const shape = Object.fromEntries(
            Object.entries(schema.properties).map(([key, propSchemaDef]) => {
              const isRequired = schema.required?.includes(key);
              let propSchema = schemaToZod(propSchemaDef);
              if (!isRequired) {
                propSchema = propSchema.optional();
              }
              return [key, propSchema];
            })
          );
          zodSchema = z.object(shape);
        } else {
          zodSchema = z.object({});
        }
        break;
      default:
        if (schema.anyOf) {
          const options = schema.anyOf.map((s) => schemaToZod(s)) as [
            z.ZodTypeAny,
            z.ZodTypeAny,
            ...z.ZodTypeAny[],
          ];
          if (options.length < 2) {
            zodSchema = options[0] || z.any();
          } else {
            zodSchema = z.union(options);
          }
        } else {
          zodSchema = z.any();
        }
        break;
    }
  }

  if (schema.description) {
    zodSchema = zodSchema.describe(schema.description);
  }

  if (schema.nullable) {
    zodSchema = zodSchema.nullable();
  }

  if (schema.default !== undefined) {
    zodSchema = zodSchema.default(schema.default);
  }

  return zodSchema;
}
