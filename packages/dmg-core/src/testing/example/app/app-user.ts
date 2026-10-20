/**
 * Пользователь учебного приложения — им приложение замыкает дженерик
 * `Caller` (D-04). В u7-school это сделает `@u7-scl/app`.
 */
export type ExampleUser = {
  readonly uuid: string;
  hasRole(role: 'admin'): boolean;
};
