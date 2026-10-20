import {
  toJsonSchema as convert,
  type JsonSchema,
} from '@valibot/to-json-schema';
import type * as v from 'valibot';

/**
 * JSON Schema входа (MAN-03): основа OPTIONS и MCP.
 * Режим `input` — `transform` (например `F.timestamp`) описывается тем,
 * что схема принимает; непереводимое бросает.
 */
export function toJsonSchema(schema: v.GenericSchema): JsonSchema {
  return convert(schema, { typeMode: 'input', errorMode: 'throw' });
}
