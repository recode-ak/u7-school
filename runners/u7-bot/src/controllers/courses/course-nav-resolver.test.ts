import { describe, expect, test } from 'bun:test';
import { presentNavLevel } from '@u7-scl/core/ui';
import type {
  ContentSnapshot,
  CourseView,
} from '@u7-scl/domain/course/contract';
import { Routes } from '../shared/routes';
import {
  type ModuleNavInfo,
  resolveCourseNavLevel,
} from './course-nav-resolver';
import { courseView, stage } from './stories/course-dmg.test-kit';

/** Адрес перехода: `prev`/`next`/`back` — строка или `{ label, address }`. */
const addressOf = (target: string | { address: string } | undefined) =>
  typeof target === 'string' ? target : target?.address;

describe('CourseNavResolver — Фаза 1: Курс и этап на общем ядре (TDD)', () => {
  const dummyCourses: CourseView[] = [
    courseView({
      uuid: 'course-1',
      title: 'Fullstack JS',
      description: 'Полный курс JavaScript',
      stages: [
        stage('Основы JS', ['mod-1', 'mod-2'], 'tech'),
        stage('Продвинутый JS', ['mod-3'], 'tech'),
      ],
    }),
    courseView({
      uuid: 'course-2',
      title: 'Python Backend',
      description: 'Курс по Python',
      stages: [stage('Основы Python', ['mod-py-1'])],
    }),
  ];

  const dummyModulesInfo: Record<string, ModuleNavInfo> = {
    'mod-1': {
      title: 'Введение в синтаксис',
      projectTitles: ['Переменные и типы', 'Условные операторы'],
    },
    'mod-2': {
      title: 'Структуры данных',
      projectTitles: ['Массивы', 'Объекты'],
    },
    'mod-3': {
      title: 'Асинхронный JS',
      projectTitles: ['Promise и async/await'],
    },
    'mod-py-1': {
      title: 'Синтаксис Python',
      projectTitles: ['Hello World'],
    },
  };

  describe('Уровень 0: Курс', () => {
    test('хлебные крошки, пояснение и список этапов с модулями подуровнем', () => {
      const level = resolveCourseNavLevel({
        level: 'course',
        courses: dummyCourses,
        currentCourseId: 'course-1',
        modulesInfo: dummyModulesInfo,
      });

      expect(level).not.toBeNull();
      expect(level?.multilineBreadcrumbs).toBe(true);
      expect(level?.breadcrumbs).toEqual([
        '📖 Курсы',
        'Курс 1/2: Fullstack JS',
      ]);
      expect(level?.subtitle).toBe('Этапы курса:');

      // Дети — этапы
      expect(level?.children).toHaveLength(2);

      const phase1 = level?.children?.[0];
      expect(phase1?.index).toBe(1);
      expect(phase1?.title).toBe('Основы JS');
      expect(phase1?.meta).toBe('(2 модуля)');
      expect(phase1?.enterable).toBe(true);
      expect(phase1?.address).toBe('course-catalog:phase:course-1:0');

      const phase2 = level?.children?.[1];
      expect(phase2?.index).toBe(2);
      expect(phase2?.title).toBe('Продвинутый JS');
      // Склонение счётчика: у второго этапа ровно один модуль
      expect(phase2?.meta).toBe('(1 модуль)');
      expect(phase2?.address).toBe('course-catalog:phase:course-1:1');
    });

    test('листание курсов: prev/next и кнопка возврата в Главное меню', () => {
      // Первый курс (нет prev, есть next)
      const level1 = resolveCourseNavLevel({
        level: 'course',
        courses: dummyCourses,
        currentCourseId: 'course-1',
        modulesInfo: dummyModulesInfo,
      });

      expect(level1?.prev).toBeUndefined();
      expect(level1?.next).toEqual({
        label: 'След. курс ▶️',
        address: 'course-catalog:course:course-2',
      });
      expect(level1?.back).toEqual({
        label: '↩️ Главное меню',
        address: Routes.app.mainMenu,
      });

      // Второй курс (есть prev, нет next)
      const level2 = resolveCourseNavLevel({
        level: 'course',
        courses: dummyCourses,
        currentCourseId: 'course-2',
        modulesInfo: dummyModulesInfo,
      });

      expect(level2?.prev).toEqual({
        label: '◀️ Пред. курс',
        address: 'course-catalog:course:course-1',
      });
      expect(level2?.next).toBeUndefined();
    });

    test('wish-кнопка курса (extraRows) зависит от статуса желания', () => {
      // 1. Без желания -> Хочу пройти курс
      const levelNone = resolveCourseNavLevel({
        level: 'course',
        courses: dummyCourses,
        currentCourseId: 'course-1',
        modulesInfo: dummyModulesInfo,
      });
      expect(levelNone?.extraRows).toHaveLength(1);
      expect(levelNone?.extraRows?.[0]?.[0]?.text).toBe('🎓 Хочу пройти курс');
      expect(levelNone?.extraRows?.[0]?.[0]?.code).toBe(
        'course-catalog:apply:course-1',
      );

      // 2. pending -> Продолжить анкету
      const levelPending = resolveCourseNavLevel({
        level: 'course',
        courses: dummyCourses,
        currentCourseId: 'course-1',
        modulesInfo: dummyModulesInfo,
        wishStatus: 'pending',
      });
      expect(levelPending?.extraRows?.[0]?.[0]?.text).toBe(
        '📝 Продолжить анкету',
      );

      // 3. expressed/confirmed -> Отменить желание
      const levelExpressed = resolveCourseNavLevel({
        level: 'course',
        courses: dummyCourses,
        currentCourseId: 'course-1',
        modulesInfo: dummyModulesInfo,
        wishStatus: 'expressed',
      });
      expect(levelExpressed?.extraRows?.[0]?.[0]?.text).toBe(
        '🗑️ Отменить желание',
      );
      expect(levelExpressed?.extraRows?.[0]?.[0]?.code).toBe(
        'course-catalog:cancel:course-1',
      );

      const levelConfirmed = resolveCourseNavLevel({
        level: 'course',
        courses: dummyCourses,
        currentCourseId: 'course-1',
        modulesInfo: dummyModulesInfo,
        wishStatus: 'confirmed',
      });
      expect(levelConfirmed?.extraRows?.[0]?.[0]?.text).toBe(
        '🗑️ Отменить желание',
      );
      expect(levelConfirmed?.extraRows?.[0]?.[0]?.code).toBe(
        'course-catalog:cancel:course-1',
      );

      // 4. fulfilled (обучение) -> Хочу пройти курс (клик ведет на W04)
      const levelFulfilled = resolveCourseNavLevel({
        level: 'course',
        courses: dummyCourses,
        currentCourseId: 'course-1',
        modulesInfo: dummyModulesInfo,
        wishStatus: 'fulfilled',
      });
      expect(levelFulfilled?.extraRows?.[0]?.[0]?.text).toBe(
        '🎓 Хочу пройти курс',
      );
      expect(levelFulfilled?.extraRows?.[0]?.[0]?.code).toBe(
        'course-catalog:apply:course-1',
      );
    });
  });

  describe('Уровень 1: Этап', () => {
    test('хлебные крошки, пояснение и список модулей с проектами подуровнем', () => {
      const level = resolveCourseNavLevel({
        level: 'phase',
        courses: dummyCourses,
        currentCourseId: 'course-1',
        phaseIdx: 0,
        modulesInfo: dummyModulesInfo,
      });

      expect(level).not.toBeNull();
      expect(level?.multilineBreadcrumbs).toBe(true);
      expect(level?.breadcrumbs).toEqual([
        '📖 Курсы',
        'Курс 1/2: Fullstack JS',
        'Этап 1/2: Основы JS',
      ]);
      expect(level?.subtitle).toBe('Модули этапа:');

      // Дети — модули
      expect(level?.children).toHaveLength(2);

      const mod1 = level?.children?.[0];
      expect(mod1?.index).toBe(1);
      expect(mod1?.title).toBe('Введение в синтаксис');
      expect(mod1?.meta).toBe('(2 проекта)');
      expect(mod1?.enterable).toBe(true);
      expect(mod1?.address).toBe('course-catalog:module:course-1:0:mod-1');

      // Назад к курсу
      expect(level?.back).toEqual({
        label: '⬅️ Назад к курсу',
        address: 'course-catalog:course:course-1',
      });
    });

    test('листание этапов в пределах курса', () => {
      // Первый этап (нет prev, есть next)
      const level0 = resolveCourseNavLevel({
        level: 'phase',
        courses: dummyCourses,
        currentCourseId: 'course-1',
        phaseIdx: 0,
        modulesInfo: dummyModulesInfo,
      });
      expect(level0?.prev).toBeUndefined();
      expect(level0?.next).toEqual({
        label: 'След. этап ▶️',
        address: 'course-catalog:phase:course-1:1',
      });

      // Второй этап (есть prev, нет next)
      const level1 = resolveCourseNavLevel({
        level: 'phase',
        courses: dummyCourses,
        currentCourseId: 'course-1',
        phaseIdx: 1,
        modulesInfo: dummyModulesInfo,
      });
      expect(level1?.prev).toEqual({
        label: '◀️ Пред. этап',
        address: 'course-catalog:phase:course-1:0',
      });
      expect(level1?.next).toBeUndefined();
    });
  });

  describe('Подключение presenter: рендеринг карточки курса', () => {
    test('presentNavLevel резолвит уровень курса в экран: текст и клавиатура', () => {
      const level = resolveCourseNavLevel({
        level: 'course',
        courses: dummyCourses,
        currentCourseId: 'course-1',
        modulesInfo: dummyModulesInfo,
      });
      expect(level).not.toBeNull();
      if (!level) return;

      const { text, keyboard } = presentNavLevel(level);

      expect(text).toContain('Курс 1/2: Fullstack JS');
      expect(keyboard.rows.flat().some((b) => b.text === 'След. курс ▶️')).toBe(
        true,
      );
    });
  });

  describe('Фаза 2: Уровни Модуль и Проект (TDD)', () => {
    const dummySnapshot: ContentSnapshot = [
      {
        projectId: 'proj-1',
        projectTitle: 'Введение в JS',
        lessons: [
          {
            lessonId: 'les-1',
            lessonTitle: 'Настройка окружения',
            stepIds: ['step-1-1', 'step-1-2'],
          },
          {
            lessonId: 'les-2',
            lessonTitle: 'Первая программа',
            stepIds: ['step-2-1'],
          },
        ],
      },
      {
        projectId: 'proj-2',
        projectTitle: 'Базовые типы и операторы',
        lessons: [
          {
            lessonId: 'les-3',
            lessonTitle: 'Числа и строки',
            stepIds: ['step-3-1'],
          },
        ],
      },
    ];

    const dummyStepTitles: Record<string, string> = {
      'step-1-1': 'Установка Bun',
      'step-1-2': 'Запуск скрипта',
      'step-2-1': 'Hello World',
      'step-3-1': 'Примитивные типы',
    };

    describe('Уровень 2: Модуль', () => {
      test('хлебные крошки, пояснение и список проектов с уроками подуровнем', () => {
        const level = resolveCourseNavLevel({
          level: 'module',
          courses: dummyCourses,
          currentCourseId: 'course-1',
          phaseIdx: 0,
          moduleId: 'mod-1',
          modulesInfo: dummyModulesInfo,
          moduleSnapshot: dummySnapshot,
        });

        expect(level).not.toBeNull();
        expect(level?.multilineBreadcrumbs).toBe(true);
        expect(level?.breadcrumbs).toEqual([
          '📖 Курсы',
          'Курс 1/2: Fullstack JS',
          'Этап 1/2: Основы JS',
          'Модуль 1/2: Введение в синтаксис',
        ]);
        expect(level?.subtitle).toBe('Проекты модуля:');

        // Дети — проекты
        expect(level?.children).toHaveLength(2);

        const proj1 = level?.children?.[0];
        expect(proj1?.index).toBe(1);
        expect(proj1?.title).toBe('Введение в JS');
        expect(proj1?.meta).toBe('(2 урока)');
        expect(proj1?.enterable).toBe(true);
        expect(proj1?.address).toBe('course-catalog:prj:course-1:mod-1:proj-1');

        // Назад к этапу
        expect(level?.back).toEqual({
          label: '⬅️ Назад к этапу',
          address: 'course-catalog:phase:course-1:0',
        });
      });

      test('листание модулей в пределах этапа', () => {
        // Первый модуль mod-1 (нет prev, есть next: mod-2)
        const level1 = resolveCourseNavLevel({
          level: 'module',
          courses: dummyCourses,
          currentCourseId: 'course-1',
          phaseIdx: 0,
          moduleId: 'mod-1',
          modulesInfo: dummyModulesInfo,
          moduleSnapshot: dummySnapshot,
        });
        expect(level1?.prev).toBeUndefined();
        expect(level1?.next).toEqual({
          label: 'След. модуль ▶️',
          address: 'course-catalog:module:course-1:0:mod-2',
        });

        // Второй модуль mod-2 (есть prev: mod-1, нет next)
        const level2 = resolveCourseNavLevel({
          level: 'module',
          courses: dummyCourses,
          currentCourseId: 'course-1',
          phaseIdx: 0,
          moduleId: 'mod-2',
          modulesInfo: dummyModulesInfo,
          moduleSnapshot: dummySnapshot,
        });
        expect(level2?.prev).toEqual({
          label: '◀️ Пред. модуль',
          address: 'course-catalog:module:course-1:0:mod-1',
        });
        expect(level2?.next).toBeUndefined();
      });
    });

    describe('Уровень 3: Проект', () => {
      test('хлебные крошки, пояснение и список уроков с шагами-заголовками подуровнем', () => {
        const level = resolveCourseNavLevel({
          level: 'project',
          courses: dummyCourses,
          currentCourseId: 'course-1',
          phaseIdx: 0,
          moduleId: 'mod-1',
          projectId: 'proj-1',
          modulesInfo: dummyModulesInfo,
          moduleSnapshot: dummySnapshot,
          stepTitles: dummyStepTitles,
        });

        expect(level).not.toBeNull();
        expect(level?.multilineBreadcrumbs).toBe(true);
        expect(level?.breadcrumbs).toEqual([
          '📖 Курсы',
          'Курс 1/2: Fullstack JS',
          'Этап 1/2: Основы JS',
          'Модуль 1/2: Введение в синтаксис',
          'Проект 1/2: Введение в JS',
        ]);
        expect(level?.subtitle).toBe('Уроки проекта:');

        // Дети — уроки
        expect(level?.children).toHaveLength(2);

        const les1 = level?.children?.[0];
        expect(les1?.index).toBe(1);
        expect(les1?.title).toBe('Настройка окружения');
        expect(les1?.meta).toBe('(2 шага)');
        expect(les1?.enterable).toBe(true);
        expect(les1?.address).toBe('course-catalog:les:course-1:proj-1:les-1');

        // Назад к модулю
        expect(level?.back).toEqual({
          label: '⬅️ Назад к модулю',
          address: 'course-catalog:module:course-1:0:mod-1',
        });
      });

      test('листание проектов в пределах модуля', () => {
        // Первый проект proj-1 (нет prev, есть next: proj-2)
        const level1 = resolveCourseNavLevel({
          level: 'project',
          courses: dummyCourses,
          currentCourseId: 'course-1',
          phaseIdx: 0,
          moduleId: 'mod-1',
          projectId: 'proj-1',
          modulesInfo: dummyModulesInfo,
          moduleSnapshot: dummySnapshot,
          stepTitles: dummyStepTitles,
        });
        expect(level1?.prev).toBeUndefined();
        expect(level1?.next).toEqual({
          label: 'След. проект ▶️',
          address: 'course-catalog:prj:course-1:mod-1:proj-2',
        });

        // Второй проект proj-2 (есть prev: proj-1, нет next)
        const level2 = resolveCourseNavLevel({
          level: 'project',
          courses: dummyCourses,
          currentCourseId: 'course-1',
          phaseIdx: 0,
          moduleId: 'mod-1',
          projectId: 'proj-2',
          modulesInfo: dummyModulesInfo,
          moduleSnapshot: dummySnapshot,
          stepTitles: dummyStepTitles,
        });
        expect(level2?.prev).toEqual({
          label: '◀️ Пред. проект',
          address: 'course-catalog:prj:course-1:mod-1:proj-1',
        });
        expect(level2?.next).toBeUndefined();
      });
    });

    describe('Уровень 4: Урок (шаги только заголовками, закрытый уровень)', () => {
      test('хлебные крошки, пояснение и одноуровневый список шагов без входа', () => {
        const level = resolveCourseNavLevel({
          level: 'lesson',
          courses: dummyCourses,
          currentCourseId: 'course-1',
          phaseIdx: 0,
          moduleId: 'mod-1',
          projectId: 'proj-1',
          lessonId: 'les-1',
          modulesInfo: dummyModulesInfo,
          moduleSnapshot: dummySnapshot,
          stepTitles: dummyStepTitles,
        });

        expect(level).not.toBeNull();
        expect(level?.multilineBreadcrumbs).toBe(true);
        expect(level?.breadcrumbs).toEqual([
          '📖 Курсы',
          'Курс 1/2: Fullstack JS',
          'Этап 1/2: Основы JS',
          'Модуль 1/2: Введение в синтаксис',
          'Проект 1/2: Введение в JS',
          'Урок 1/2: Настройка окружения',
        ]);
        expect(level?.subtitle).toBe('Шаги урока:');

        // Дети — шаги
        expect(level?.children).toHaveLength(2);

        const step1 = level?.children?.[0];
        expect(step1?.index).toBe(1);
        expect(step1?.title).toBe('Установка Bun');
        expect(step1?.enterable).toBe(false);
        expect(step1?.address).toBeUndefined();
        expect(step1?.children).toBeUndefined();

        const step2 = level?.children?.[1];
        expect(step2?.index).toBe(2);
        expect(step2?.title).toBe('Запуск скрипта');
        expect(step2?.enterable).toBe(false);
        expect(step2?.address).toBeUndefined();

        // Назад к проекту
        expect(level?.back).toEqual({
          label: '⬅️ Назад к проекту',
          address: 'course-catalog:prj:course-1:mod-1:proj-1',
        });
      });

      test('листание уроков в пределах проекта', () => {
        // Первый урок les-1 (нет prev, есть next: les-2)
        const level1 = resolveCourseNavLevel({
          level: 'lesson',
          courses: dummyCourses,
          currentCourseId: 'course-1',
          phaseIdx: 0,
          moduleId: 'mod-1',
          projectId: 'proj-1',
          lessonId: 'les-1',
          modulesInfo: dummyModulesInfo,
          moduleSnapshot: dummySnapshot,
          stepTitles: dummyStepTitles,
        });
        expect(level1?.prev).toBeUndefined();
        expect(level1?.next).toEqual({
          label: 'След. урок ▶️',
          address: 'course-catalog:les:course-1:proj-1:les-2',
        });

        // Второй урок les-2 (есть prev: les-1, нет next)
        const level2 = resolveCourseNavLevel({
          level: 'lesson',
          courses: dummyCourses,
          currentCourseId: 'course-1',
          phaseIdx: 0,
          moduleId: 'mod-1',
          projectId: 'proj-1',
          lessonId: 'les-2',
          modulesInfo: dummyModulesInfo,
          moduleSnapshot: dummySnapshot,
          stepTitles: dummyStepTitles,
        });
        expect(level2?.prev).toEqual({
          label: '◀️ Пред. урок',
          address: 'course-catalog:les:course-1:proj-1:les-1',
        });
        expect(level2?.next).toBeUndefined();
      });
    });
  });

  describe('Курс из одного этапа: карточка курса сразу показывает модули этапа', () => {
    const snapshot: ContentSnapshot = [
      {
        projectId: 'proj-py',
        projectTitle: 'Hello World',
        lessons: [{ lessonId: 'les-py', lessonTitle: 'Старт', stepIds: [] }],
      },
    ];

    test('уровень курса: крошки с этапом, «Модули этапа:», модули этапа, кнопки желания и соседних курсов', () => {
      const level = resolveCourseNavLevel({
        level: 'course',
        courses: dummyCourses,
        currentCourseId: 'course-2',
        modulesInfo: dummyModulesInfo,
      });

      expect(level?.breadcrumbs).toEqual([
        '📖 Курсы',
        'Курс 2/2: Python Backend',
        'Этап 1/1: Основы Python',
      ]);
      expect(level?.subtitle).toBe('Модули этапа:');
      expect(level?.children).toHaveLength(1);
      expect(level?.children?.[0]).toMatchObject({
        index: 1,
        title: 'Синтаксис Python',
        meta: '(1 проект)',
        enterable: true,
        address: 'course-catalog:module:course-2:0:mod-py-1',
      });
      expect(level?.extraRows?.[0]?.[0]?.code).toBe(
        'course-catalog:apply:course-2',
      );
      expect(addressOf(level?.prev)).toBe('course-catalog:course:course-1');
      expect(addressOf(level?.back)).toBe(Routes.app.mainMenu);
    });

    test('уровень модуля: крошки с этапом, «Назад к курсу» вместо «Назад к этапу»', () => {
      const level = resolveCourseNavLevel({
        level: 'module',
        courses: dummyCourses,
        currentCourseId: 'course-2',
        phaseIdx: 0,
        moduleId: 'mod-py-1',
        modulesInfo: dummyModulesInfo,
        moduleSnapshot: snapshot,
      });

      expect(level?.breadcrumbs).toEqual([
        '📖 Курсы',
        'Курс 2/2: Python Backend',
        'Этап 1/1: Основы Python',
        'Модуль 1/1: Синтаксис Python',
      ]);
      expect(level?.back).toEqual({
        label: '⬅️ Назад к курсу',
        address: 'course-catalog:course:course-2',
      });
    });

    test('уровень этапа (колбэк старых сообщений): прежний экран этапа', () => {
      const level = resolveCourseNavLevel({
        level: 'phase',
        courses: dummyCourses,
        currentCourseId: 'course-2',
        phaseIdx: 0,
        modulesInfo: dummyModulesInfo,
      });

      expect(level?.breadcrumbs).toEqual([
        '📖 Курсы',
        'Курс 2/2: Python Backend',
        'Этап 1/1: Основы Python',
      ]);
      expect(level?.subtitle).toBe('Модули этапа:');
      expect(level?.children?.[0]?.address).toBe(
        'course-catalog:module:course-2:0:mod-py-1',
      );
      expect(addressOf(level?.back)).toBe('course-catalog:course:course-2');
    });
  });

  describe('Курс без этапов: область — вся программа, уровня этапа нет', () => {
    const noStages = courseView({
      uuid: 'course-3',
      title: 'Курс без этапов',
      moduleIds: ['mod-1', 'mod-2'],
      stages: [],
    });
    // Курс в середине списка: есть и «Пред. курс», и «След. курс».
    const courses = [dummyCourses[0]!, noStages, dummyCourses[1]!];
    const snapshot: ContentSnapshot = [
      {
        projectId: 'proj-1',
        projectTitle: 'Введение в JS',
        lessons: [
          { lessonId: 'les-1', lessonTitle: 'Окружение', stepIds: ['s-1'] },
        ],
      },
    ];
    const modulesInfo: Record<string, ModuleNavInfo> = {
      'mod-1': { title: 'Введение в синтаксис', projectTitles: ['A', 'B'] },
      'mod-2': { title: 'Структуры данных', projectTitles: ['C'] },
    };

    test('уровень курса: «Модули курса:», строки модулей, кнопки желания и соседних курсов', () => {
      const level = resolveCourseNavLevel({
        level: 'course',
        courses,
        currentCourseId: 'course-3',
        modulesInfo,
      });

      expect(level?.breadcrumbs).toEqual([
        '📖 Курсы',
        'Курс 2/3: Курс без этапов',
      ]);
      expect(level?.subtitle).toBe('Модули курса:');
      expect(level?.children).toHaveLength(2);
      expect(level?.children?.[0]).toMatchObject({
        index: 1,
        title: 'Введение в синтаксис',
        meta: '(2 проекта)',
        enterable: true,
        address: 'course-catalog:module:course-3:0:mod-1',
      });
      expect(level?.children?.[1]).toMatchObject({
        index: 2,
        title: 'Структуры данных',
        meta: '(1 проект)',
        address: 'course-catalog:module:course-3:0:mod-2',
      });
      expect(level?.extraRows?.[0]?.[0]?.code).toBe(
        'course-catalog:apply:course-3',
      );
      expect(addressOf(level?.prev)).toBe('course-catalog:course:course-1');
      expect(addressOf(level?.next)).toBe('course-catalog:course:course-2');
    });

    test('уровень модуля: крошки без этапа, листание по всей программе, «Назад к курсу»', () => {
      const first = resolveCourseNavLevel({
        level: 'module',
        courses,
        currentCourseId: 'course-3',
        phaseIdx: 0,
        moduleId: 'mod-1',
        modulesInfo,
        moduleSnapshot: snapshot,
      });

      expect(first?.breadcrumbs).toEqual([
        '📖 Курсы',
        'Курс 2/3: Курс без этапов',
        'Модуль 1/2: Введение в синтаксис',
      ]);
      expect(first?.prev).toBeUndefined();
      expect(first?.next).toEqual({
        label: 'След. модуль ▶️',
        address: 'course-catalog:module:course-3:0:mod-2',
      });
      expect(first?.back).toEqual({
        label: '⬅️ Назад к курсу',
        address: 'course-catalog:course:course-3',
      });

      const last = resolveCourseNavLevel({
        level: 'module',
        courses,
        currentCourseId: 'course-3',
        phaseIdx: 0,
        moduleId: 'mod-2',
        modulesInfo,
        moduleSnapshot: snapshot,
      });
      expect(addressOf(last?.prev)).toBe(
        'course-catalog:module:course-3:0:mod-1',
      );
      expect(last?.next).toBeUndefined();
    });

    test('уровни проекта и урока: крошки без этапа, «Назад к модулю» с :0:<модуль>', () => {
      const project = resolveCourseNavLevel({
        level: 'project',
        courses,
        currentCourseId: 'course-3',
        phaseIdx: 0,
        moduleId: 'mod-1',
        projectId: 'proj-1',
        modulesInfo,
        moduleSnapshot: snapshot,
      });
      expect(project?.breadcrumbs).toEqual([
        '📖 Курсы',
        'Курс 2/3: Курс без этапов',
        'Модуль 1/2: Введение в синтаксис',
        'Проект 1/1: Введение в JS',
      ]);
      expect(addressOf(project?.back)).toBe(
        'course-catalog:module:course-3:0:mod-1',
      );

      const lesson = resolveCourseNavLevel({
        level: 'lesson',
        courses,
        currentCourseId: 'course-3',
        phaseIdx: 0,
        moduleId: 'mod-1',
        projectId: 'proj-1',
        lessonId: 'les-1',
        modulesInfo,
        moduleSnapshot: snapshot,
        stepTitles: { 's-1': 'Установка' },
      });
      expect(lesson?.breadcrumbs).toEqual([
        '📖 Курсы',
        'Курс 2/3: Курс без этапов',
        'Модуль 1/2: Введение в синтаксис',
        'Проект 1/1: Введение в JS',
        'Урок 1/1: Окружение',
      ]);
      expect(addressOf(lesson?.back)).toBe(
        'course-catalog:prj:course-3:mod-1:proj-1',
      );
    });

    test('уровня этапа нет — phase даёт null', () => {
      expect(
        resolveCourseNavLevel({
          level: 'phase',
          courses,
          currentCourseId: 'course-3',
          phaseIdx: 0,
          modulesInfo,
        }),
      ).toBeNull();
    });
  });

  describe('Два этапа — поведение этапов без изменений', () => {
    const twoStages = courseView({
      uuid: 'course-4',
      title: 'Два этапа',
      stages: [stage('Первый', ['m-a']), stage('Второй', ['m-b', 'm-c'])],
    });
    const modulesInfo: Record<string, ModuleNavInfo> = {
      'm-a': { title: 'A', projectTitles: [] },
      'm-b': { title: 'B', projectTitles: [] },
      'm-c': { title: 'C', projectTitles: [] },
    };
    const snapshot: ContentSnapshot = [
      { projectId: 'p', projectTitle: 'P', lessons: [] },
    ];

    test('модуль второго этапа: пред. модуль — адрес с индексом этапа', () => {
      const level = resolveCourseNavLevel({
        level: 'module',
        courses: [twoStages],
        currentCourseId: 'course-4',
        phaseIdx: 1,
        moduleId: 'm-c',
        modulesInfo,
        moduleSnapshot: snapshot,
      });

      expect(addressOf(level?.prev)).toBe(
        'course-catalog:module:course-4:1:m-b',
      );
    });
  });
});
