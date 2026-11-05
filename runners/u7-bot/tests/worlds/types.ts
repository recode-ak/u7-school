import type { CourseState, Lesson, Module, Step } from '@u7-scl/course/domain';
import type {
  ReviewDirection,
  StudentOutcome,
} from '@u7-scl/domain/peer-review/contract';
import type { QuestionnaireView } from '@u7-scl/domain/questionnaire/contract';
import type {
  StreamState,
  StreamStatus,
  StudentState,
} from '@u7-scl/stream/domain';
import type { Role, User } from '@u7-scl/user/domain';
import type { WishState } from '@u7-scl/wish/domain';

/**
 * Кампания в мире — ввод state (не state): даты ISO, как в legacy-файле;
 * `ReviewCampaignArDef.state` переводит их в число UTC при чтении (D-36).
 */
export interface WorldCampaign {
  uuid: string;
  context: 'stream_fate';
  scopeId: string;
  subjectId: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt: string;
  participants: string[];
  payload: { subjectOutcome: StudentOutcome; mentorId: string };
}

/**
 * Отзыв в мире — ввод state (не state): даты ISO, как в legacy-файле;
 * `ReviewArDef.state` переводит их в число UTC и дописывает `updatedAt` (D-36).
 */
export interface WorldReview {
  uuid: string;
  scopeId: string;
  campaignId: string;
  authorId: string;
  direction: ReviewDirection;
  authorOutcome?: StudentOutcome;
  recipientId: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Курс в мире — ввод state (не state): даты ISO, как в legacy-файле, `version`
 * необязательна; `CourseArDef.state` переводит даты в число UTC и дописывает
 * `updatedAt`, `version` по умолчанию 0 (D-36).
 */
export type WorldCourse = Omit<
  CourseState,
  'createdAt' | 'updatedAt' | 'version'
> & {
  createdAt: string;
  updatedAt?: string;
  version?: number;
};

/**
 * WorldState — центральный объект состояния мира.
 * Коллекции state-объектов агрегатов, нейтральные к хранилищу (plain-данные).
 */
export interface WorldState {
  users: User[];
  streams: StreamState[];
  students: StudentState[];
  courses: WorldCourse[];
  modules: Module[];
  lessons: Lesson[];
  steps: Step[];
  campaigns: WorldCampaign[];
  reviews: WorldReview[];
  wishes: WishState[];
  questionnaires: QuestionnaireView[];
  sessions: unknown[];
  shortIds: unknown[];
}

/** Персона dev-режима (для реестра /persona). */
export interface DevPersonaInfo {
  key: string;
  name: string;
  about: string;
  telegramId: number;
}

/** Декларативное описание персоны */
export interface PersonDef {
  key: string;
  uuid?: string;
  name: string;
  telegramId: number;
  roles: (Role | `${Role}`)[];
  registeredAt?: string;
  nick?: string;
  about?: string;
}

/** Декларативное описание шага */
export interface StepDef {
  key: string;
  uuid?: string;
  title?: string;
  description?: string;
  content?: string;
  theoryUrl?: string;
  code?: string;
  kind?: 'text' | 'code' | 'file';
}

/** Декларативное описание урока */
export interface LessonDef {
  key: string;
  uuid?: string;
  title: string;
  steps?: StepDef[];
}

/** Декларативное описание проекта */
export interface ProjectDef {
  key: string;
  uuid?: string;
  title: string;
  lessons?: LessonDef[];
}

/** Декларативное описание модуля */
export interface ModuleDef {
  key: string;
  uuid?: string;
  title: string;
  description?: string;
  projects?: ProjectDef[];
}

/** Декларативное описание этапа: заголовок и модуль, с которого он начинается */
export interface CoursePhaseDef {
  title: string;
  track?: string;
  fromModuleId: string;
}

/** Декларативное описание курса */
export interface CourseDef {
  key: string;
  uuid?: string;
  title: string;
  description: string;
  authorKey: string;
  modules?: ModuleDef[];
  /** Программа курса: id модулей по порядку; по умолчанию — модули `modules`. */
  moduleIds?: string[];
  /** Этапы программы; по умолчанию — один этап с первого модуля. */
  phases?: CoursePhaseDef[];
}

/** Декларативное описание потока */
export interface StreamDef {
  key: string;
  uuid?: string;
  schoolId?: string;
  title: string;
  description: string;
  courseKey: string;
  moduleKey?: string;
  moduleId?: string;
  mentorKey: string;
  status: StreamStatus | `${StreamStatus}`;
  startedAt?: string;
  telegramGroupId?: string;
  telegramGroupInvite?: string;
  goal?: string;
  result?: string;
  enrollmentKey?: string;
  contentSnapshot?: unknown[];
}

/** Запись о прохождении шага студентом */
export interface StudentStepDef {
  stepKey?: string;
  stepId?: string;
  status: 'issued' | 'completed';
  issuedAt?: string;
  completedAt?: string;
}

/** Декларативное описание студента */
export interface StudentDef {
  key: string;
  uuid?: string;
  personKey: string;
  streamKey: string;
  enrolledAt: string;
  status: 'enrolled' | 'active' | 'abandoned' | 'advanced' | 'not_advanced';
  currentStepKey?: string;
  currentStepId?: string;
  steps?: StudentStepDef[];
}

/** Декларативное описание кампании отзывов */
export interface CampaignDef {
  key: string;
  uuid?: string;
  context: 'stream_fate';
  streamKey: string;
  subjectPersonKey: string;
  mentorPersonKey: string;
  subjectOutcome: StudentOutcome;
  createdAt: string;
  expiresAt: string;
  participants?: string[];
}

/** Декларативное описание отзыва */
export interface ReviewDef {
  key: string;
  uuid?: string;
  campaignKey: string;
  authorPersonKey: string;
  recipientPersonKey: string;
  direction: ReviewDirection;
  authorOutcome?: StudentOutcome;
  text: string;
  createdAt?: string;
}

/** Манифест материализованного мира */
export interface WorldManifest {
  name: string;
  hash: string;
  generatedAt: string;
  sourceHash?: string;
}

/** Полная декларация тестового мира */
export interface WorldDefinition {
  name?: string;
  description?: string;
  anchorDate?: Date;
  persons?: PersonDef[];
  courses?: CourseDef[];
  streams?: StreamDef[];
  students?: StudentDef[];
  campaigns?: CampaignDef[];
  reviews?: ReviewDef[];
  wishes?: WishState[];
  questionnaires?: QuestionnaireView[];
}

/** Зарегистрированный мир с готовой функцией сборки состояния */
export interface RegisteredWorld extends WorldDefinition {
  buildState(): WorldState;
}
