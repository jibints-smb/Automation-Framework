/** Types for redact.cjs (plain JavaScript so report scripts can use it without TypeScript). */
export declare const MASK: string;
export declare function secretsFrom(settings: Record<string, string | undefined>): string[];
export declare function loadSecrets(rootDir?: string): string[];
export declare function redactText(text: string, secrets?: string[]): string;
export declare function redactDeep<T>(value: T, secrets: string[]): T;
export declare function redactResultsDir(dir: string, secrets?: string[]): number;
