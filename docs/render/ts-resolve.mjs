// Lets plain node (with --experimental-strip-types) import the plugin's modules, whose
// relative imports carry no extension: tries the specifier as given, then with .ts.
import { register } from 'node:module'

register(
  'data:text/javascript,' +
    encodeURIComponent(`export async function resolve(specifier, context, next) {
  try { return await next(specifier, context) } catch (error) {
    if (specifier.startsWith('.') && !/\\.[cm]?[jt]sx?$/.test(specifier)) return next(specifier + '.ts', context)
    throw error
  }
}`),
)
