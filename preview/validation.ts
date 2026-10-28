// Preview build only: photos are inlined as data: URLs, which the real product rules do not accept.
// preview/vite.config.mjs points every other import of lib/validation at this file.
import { z } from 'zod';
import * as real from '../lib/validation';
export * from '../lib/validation';
export const productInput = real.productInput.extend({ image: z.string().nullable() });
