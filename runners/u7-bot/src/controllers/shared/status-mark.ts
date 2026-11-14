/**
 * Отметка статуса контента для тех, кому API курса отдаёт неопубликованное
 * (ментор, админ, автор модуля). Зависит только от `status` в ответе UC:
 * права UI не считает (DOM-18). Опубликованное и неизвестный статус — без отметки.
 */

const ICONS: Record<string, string> = { draft: '🚧', archived: '🗄' };
const LABELS: Record<string, string> = {
  draft: '🚧 Черновик',
  archived: '🗄 В архиве',
};

/** Название с префиксом-значком (кнопки и строки списков). */
export function withStatusIcon(title: string, status?: string): string {
  const icon = status ? ICONS[status] : undefined;
  return icon ? `${icon} ${title}` : title;
}

/** Название с текстовой отметкой (заголовок карточки). */
export function withStatusLabel(title: string, status?: string): string {
  const label = status ? LABELS[status] : undefined;
  return label ? `${label}: ${title}` : title;
}
