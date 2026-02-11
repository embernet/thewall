import { personaRegistry } from './base';
import { builtInPersonas } from './built-in';

export function registerBuiltInPersonas(): void {
  for (const persona of builtInPersonas) {
    personaRegistry.register(persona);
  }
}

export { personaRegistry } from './base';
export { builtInPersonas } from './built-in';
