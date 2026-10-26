/**
 * Пользователь учебного приложения — им приложение замыкает дженерик
 * `Caller` (D-04). В приложении это делает его пакет `app`.
 */
export type ExampleUser = {
  readonly uuid: string;
  hasRole(role: 'admin'): boolean;
};
