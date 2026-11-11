import type { ApiApp } from '@u7-scl/core/api';
import type { AppMeta, AppResolver } from '@u7-scl/core/domain';
import type { UserView } from '@u7-scl/domain/user/contract';
import type { School } from './school';

// ══ Специализация core/api на уровне приложения u7-school ══
//
// Актор закрыт на UserView, резолвер — на U7AppResolver (содержит School).

/**
 * Глобальные зависимости уровня приложения u7-school.
 * Содержит сквозные сервисы и сущность школы.
 */
export interface U7AppResolver extends AppResolver {
  school: School;
}

/** Тип API-приложения u7-school: актор закрыт на `UserView` */
export type U7ApiApp<TMeta extends AppMeta> = ApiApp<TMeta, UserView>;
