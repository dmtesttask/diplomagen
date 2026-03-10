/**
 * Browser polyfill for Node.js Buffer.
 * Required by @pdfme/schemas (text rendering / fontkit) which does
 *   import { Buffer } from 'buffer';
 * The 'buffer' npm package provides a browser-compatible implementation,
 * but esbuild/Angular does not auto-polyfill Node.js built-ins.
 * Setting globalThis.Buffer ensures the import resolves correctly everywhere.
 */
import { Buffer } from 'buffer';
(globalThis as any).Buffer = Buffer;
