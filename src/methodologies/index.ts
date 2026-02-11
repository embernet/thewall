import { methodologyRegistry } from './base';
import { swotMethodology } from './swot';
import { scamperMethodology } from './scamper';

export function registerBuiltInMethodologies(): void {
  methodologyRegistry.register(swotMethodology);
  methodologyRegistry.register(scamperMethodology);
}

export { methodologyRegistry } from './base';
export { swotMethodology } from './swot';
export { scamperMethodology } from './scamper';
