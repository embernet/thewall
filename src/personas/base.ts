export interface Persona {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  systemPromptPrefix: string;
}

class PersonaRegistry {
  private personas = new Map<string, Persona>();
  private active: Persona | null = null;

  register(p: Persona): void {
    this.personas.set(p.id, p);
  }

  get(id: string): Persona | undefined {
    return this.personas.get(id);
  }

  list(): Persona[] {
    return [...this.personas.values()];
  }

  setActive(id: string | null): void {
    this.active = id ? this.personas.get(id) || null : null;
  }

  getActive(): Persona | null {
    return this.active;
  }

  /** Returns the active persona's system prompt prefix, or empty string. */
  getPromptPrefix(): string {
    return this.active?.systemPromptPrefix || '';
  }
}

export const personaRegistry = new PersonaRegistry();
