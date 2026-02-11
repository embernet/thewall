import { toolRegistry } from './adapter';
import { graphSearchTool } from './graph-search';
import { graphAddTool } from './graph-add';

export function registerBuiltInTools(): void {
  toolRegistry.register(graphSearchTool);
  toolRegistry.register(graphAddTool);
}

export { toolRegistry } from './adapter';
