import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import type { MenuButton } from '@u7-scl/bot/u7-menu';
import { md } from '@u7-scl/core/shared';
import {
  type BotSession,
  type DialogResponse,
  presentNavLevel,
} from '@u7-scl/core/ui';
import {
  type ContentSnapshot,
  CourseModuleDef,
  type CourseView,
  GetCourseByModuleUcDef,
  GetCourseUcDef,
  GetModuleSnapshotUcDef,
  GetModuleUcDef,
  GetStepsByLessonsUcDef,
  ListCoursesUcDef,
} from '@u7-scl/domain/course/contract';
import {
  CancelWishUcDef,
  CreateCourseWishUcDef,
  CreateModuleWishUcDef,
  ListUserWishesUcDef,
  WishErrors,
  WishModuleDef,
} from '@u7-scl/domain/wish/contract';
import { buttons } from '../../shared/buttons';
import { Routes } from '../../shared/routes';
import { withStatusIcon } from '../../shared/status-mark';
import { resolveCourseNavLevel } from '../course-nav-resolver';

/** Карточка модуля для списка: заголовок и проекты. */
interface ModuleCardInfo {
  title: string;
  projectCount?: number;
  lessonCount?: number;
  projects?: Array<{ title: string; lessonCount?: number }>;
  projectTitles?: string[];
}

/**
 * Ответ загрузчика: данные или экран отказа UC. Решает обработчик, не загрузчик
 * (ERR-06): ошибка списка курсов не превращается в «нет курсов».
 */
type LoadResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: DialogResponse };

/** Индекс этапа модуля; без этапов или без модуля в этапах — 0 (в адресе игнорируется). */
function stageIndexOf(course: CourseView, moduleId: string): number {
  return Math.max(
    0,
    course.stages.findIndex((s) => s.moduleIds.includes(moduleId)),
  );
}

/**
 * Story «Программы курсов» — каталог учебных курсов школы.
 * Доступна всем ролям.
 *
 * Единая иерархия drill-down (курс → этап → модуль → проект → урок)
 * на базе presenter'а content-nav.
 */
export class CourseCatalogStory extends U7BotUiStory {
  readonly name = 'course-catalog';

  // ── Главное меню (декларативные кнопки) ──

  override async menuButtons(_actor: U7BotActor): Promise<MenuButton[]> {
    return [
      {
        kind: 'callback',
        text: '📖 Курсы',
        action: this.cb('list'),
        priority: 12,
        description: '📖 Курсы — каталог учебных курсов и их структура',
      },
    ];
  }

  // ── Callback ──

  override async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    const [cmd, ...ids] = action.split(':');

    switch (cmd) {
      case 'list':
      case 'course':
        return this.#handleCourse(ids[0], actor);
      case 'phase':
        return this.#handlePhase(actor, ids[0] ?? '', Number(ids[1]));
      case 'phases':
        // Совместимость со старыми колбэками: phases:<courseId> -> карточка курса
        return this.#handleCourse(ids[0], actor);
      case 'module':
        return this.#handleModule(
          actor,
          ids[0] ?? '',
          Number(ids[1]),
          ids[2] ?? '',
        );
      case 'modules':
        // Совместимость со старыми колбэками: modules:<courseId>:<phaseIdx> -> карточка этапа
        return this.#handlePhase(actor, ids[0] ?? '', Number(ids[1]));
      case 'prj':
      case 'project':
      case 'projects': {
        // Старый формат: projects:<courseId>:<phaseIdx>:<moduleId> -> карточка модуля
        if (cmd === 'projects' && ids.length === 3) {
          return this.#handleModule(
            actor,
            ids[0] ?? '',
            Number(ids[1]),
            ids[2] ?? '',
          );
        }
        // Формат 4 сегмента: project:<courseId>:<phaseIdx>:<moduleId>:<projId>
        if (ids.length >= 4) {
          return this.#handleProject(actor, ids[2] ?? '', ids[3] ?? '', ids[0]);
        }
        // Новый компактный формат: prj:<courseId>:<moduleId>:<projId>
        if (ids.length === 3) {
          return this.#handleProject(actor, ids[1] ?? '', ids[2] ?? '', ids[0]);
        }
        // Предыдущий формат: project:<moduleId>:<projId>
        const modId = ids[0] ?? '';
        const projId = ids[1] ?? '';
        return this.#handleProject(actor, modId, projId);
      }
      case 'les':
      case 'lesson':
      case 'lessons': {
        // Старый формат: lessons:<courseId>:<phaseIdx>:<moduleId>:<projectIdx> -> карточка проекта
        if (cmd === 'lessons' && ids.length === 4) {
          const modId = ids[2] ?? '';
          const pIdxOrId = ids[3] ?? '';
          return this.#handleLegacyProjectByIndex(actor, modId, pIdxOrId);
        }
        // Формат 5 сегментов: lesson:<courseId>:<phaseIdx>:<moduleId>:<projId>:<lesId>
        if (ids.length >= 5) {
          return this.#handleLesson(
            actor,
            ids[3] ?? '',
            ids[4] ?? '',
            ids[0],
            ids[2],
          );
        }
        // Формат 4 сегмента: les:<courseId>:<moduleId>:<projId>:<lesId>
        if (ids.length === 4) {
          return this.#handleLesson(
            actor,
            ids[2] ?? '',
            ids[3] ?? '',
            ids[0],
            ids[1],
          );
        }
        // Новый 3-UUID формат: les:<courseId>:<projId>:<lesId>
        if (ids.length === 3) {
          return this.#handleLesson(actor, ids[1] ?? '', ids[2] ?? '', ids[0]);
        }
        // Предыдущий формат: lesson:<projId>:<lesId>
        const projId = ids[0] ?? '';
        const lesId = ids[1] ?? '';
        return this.#handleLesson(actor, projId, lesId);
      }
      case 'wish':
        return this.#handleWishModule(ids[0] ?? '', actor);
      case 'apply':
        return this.#handleApply(ids[0] ?? '', actor);
      case 'cancel':
        // W05 — экран подтверждения отмены желания курса
        return this.confirm(
          'cancel',
          ids[0] ?? '',
          md`Отменить желание пройти курс?`,
          {
            cancelCode: this.cb('course', ids[0] ?? ''),
          },
        );
      case 'cancel-confirm':
        return this.#handleCancelConfirm(ids[0] ?? '', actor);
      case 'cancel-mod':
        // W05-M — экран подтверждения отмены желания модуля
        return this.confirm(
          'cancel-mod',
          ids[0] ?? '',
          md`Отменить желание пройти модуль?`,
          {
            cancelCode: Routes.app.mainMenu,
          },
        );
      case 'cancel-mod-confirm':
        return this.#handleCancelModConfirm(ids[0] ?? '', actor);
      default:
        return this.unknownCommand(action, actor, session);
    }
  }

  // ═══ Уровень 0: Курс (карточка курса + этапы подуровнем) ═══

  async #handleCourse(
    courseId: string | undefined,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const loaded = await this.#loadCourses(actor, courseId);
    if (!loaded.ok) return loaded.response;
    const courses = loaded.value;
    if (courses.length === 0) {
      if (courseId) {
        return this.screen(md`⚠️ Курс не найден или недоступен`);
      }
      return this.screen(
        md`📖 *Курсы*\\n\\nПока нет доступных курсов\\.`,
        this.kb([[buttons.mainMenu()]]),
      );
    }

    const currentCourse = courseId
      ? courses.find((c) => c.uuid === courseId)
      : courses[0];

    if (!currentCourse) {
      return this.screen(md`⚠️ Курс не найден или недоступен`);
    }

    const allModIds = currentCourse.moduleIds;
    const modulesInfo = await this.#loadModulesInfo(actor, allModIds);

    const wishes = await this.dispatchUc(
      WishModuleDef,
      ListUserWishesUcDef.command({}),
      actor,
    );
    if (!wishes.ok) return this.ucErrorNotify(wishes.error);
    const wishStatus = wishes.value.find(
      (w) =>
        w.target.kind === 'course' && w.target.courseId === currentCourse.uuid,
    )?.status;

    const navLevel = resolveCourseNavLevel({
      level: 'course',
      courses,
      currentCourseId: currentCourse.uuid,
      modulesInfo,
      wishStatus,
    });

    if (!navLevel) {
      return this.screen(md`⚠️ Курс не найден или недоступен`);
    }

    const { text, keyboard } = presentNavLevel(navLevel);
    return this.screen(text, keyboard);
  }

  // ═══ Уровень 1: Этап (карточка этапа + модули подуровнем) ═══

  async #handlePhase(
    actor: U7BotActor,
    courseId: string,
    phaseIdx: number,
  ): Promise<DialogResponse> {
    if (!courseId) {
      return this.screen(md`⚠️ Курс не указан`);
    }

    const loaded = await this.#loadCourses(actor, courseId);
    if (!loaded.ok) return loaded.response;
    const courses = loaded.value;
    const course = courses.find((c) => c.uuid === courseId);
    if (!course) {
      return this.screen(md`⚠️ Курс не найден или недоступен`);
    }

    const stage = course.stages[phaseIdx];
    if (!stage) {
      return this.screen(md`⚠️ Этап не найден или недоступен`);
    }

    const modulesInfo = await this.#loadModulesInfo(actor, stage.moduleIds);

    const navLevel = resolveCourseNavLevel({
      level: 'phase',
      courses,
      currentCourseId: courseId,
      phaseIdx,
      modulesInfo,
    });

    if (!navLevel) {
      return this.screen(md`⚠️ Этап не найден или недоступен`);
    }

    const { text, keyboard } = presentNavLevel(navLevel);
    return this.screen(text, keyboard);
  }

  // ═══ Уровень 2: Модуль (карточка модуля + проекты подуровнем) ═══

  async #handleModule(
    actor: U7BotActor,
    courseId: string,
    phaseIdx: number,
    moduleId: string,
  ): Promise<DialogResponse> {
    if (!moduleId) {
      return this.screen(md`⚠️ Модуль не указан`);
    }

    const loaded = await this.#loadCourses(actor, courseId);
    if (!loaded.ok) return loaded.response;
    const courses = loaded.value;
    let course = courses.find((c) => c.uuid === courseId);
    if (!course) {
      const byModule = await this.dispatchUc(
        CourseModuleDef,
        GetCourseByModuleUcDef.command({ moduleId }),
        actor,
      );
      if (byModule.ok && byModule.value) {
        const c = byModule.value;
        course = c;
        if (!courses.some((x) => x.uuid === c.uuid)) courses.push(c);
      }
    }
    if (!course) {
      return this.screen(md`⚠️ Курс не найден или недоступен`);
    }

    const loadedSnapshot = await this.dispatchUc(
      CourseModuleDef,
      GetModuleSnapshotUcDef.command({ moduleId }),
      actor,
    );
    if (!loadedSnapshot.ok) {
      return this.screen(md`⚠️ Модуль не найден или недоступен`);
    }
    const snapshot: ContentSnapshot = loadedSnapshot.value;

    let modTitle = `Модуль ${moduleId.slice(0, 8)}`;
    const mod = await this.dispatchUc(
      CourseModuleDef,
      GetModuleUcDef.command({ moduleId }),
      actor,
    );
    if (mod.ok && mod.value.title) modTitle = mod.value.title;

    const navLevel = resolveCourseNavLevel({
      level: 'module',
      courses,
      currentCourseId: courseId,
      phaseIdx,
      moduleId,
      modulesInfo: { [moduleId]: { title: modTitle } },
      moduleSnapshot: snapshot,
    });

    if (!navLevel) {
      return this.screen(md`⚠️ Модуль не найден или недоступен`);
    }

    const { text, keyboard } = presentNavLevel(navLevel);
    return this.screen(text, keyboard);
  }

  // ═══ Уровень 3: Проект (карточка проекта + уроки подуровнем) ═══

  async #handleProject(
    actor: U7BotActor,
    moduleId: string,
    projectId: string,
    courseId?: string,
  ): Promise<DialogResponse> {
    const loaded = await this.#loadCourses(actor, courseId);
    if (!loaded.ok) return loaded.response;
    const courses = loaded.value;
    let course = courseId
      ? courses.find((c) => c.uuid === courseId)
      : undefined;
    if (!course) {
      course = courses.find((c) => c.moduleIds.includes(moduleId));
    }
    if (!course) {
      const byModule = await this.dispatchUc(
        CourseModuleDef,
        GetCourseByModuleUcDef.command({ moduleId }),
        actor,
      );
      if (byModule.ok && byModule.value) {
        const c = byModule.value;
        course = c;
        if (!courses.some((x) => x.uuid === c.uuid)) courses.push(c);
      }
    }
    course ??= courses[0];
    if (!course) {
      return this.screen(md`⚠️ Курс не найден или недоступен`);
    }

    const phaseIdx = stageIndexOf(course, moduleId);

    const loadedSnapshot = await this.dispatchUc(
      CourseModuleDef,
      GetModuleSnapshotUcDef.command({ moduleId }),
      actor,
    );
    if (!loadedSnapshot.ok) {
      return this.screen(md`⚠️ Модуль не найден или недоступен`);
    }
    const snapshot: ContentSnapshot = loadedSnapshot.value;

    const project = snapshot.find((p) => p.projectId === projectId);
    if (!project) {
      return this.screen(md`⚠️ Проект не найден`);
    }

    let modTitle = `Модуль ${moduleId.slice(0, 8)}`;
    const mod = await this.dispatchUc(
      CourseModuleDef,
      GetModuleUcDef.command({ moduleId }),
      actor,
    );
    if (mod.ok && mod.value.title) modTitle = mod.value.title;

    const lessonIds = project.lessons.map((l) => l.lessonId);
    const stepTitles = await this.#loadStepTitles(actor, lessonIds);

    const navLevel = resolveCourseNavLevel({
      level: 'project',
      courses,
      currentCourseId: course.uuid,
      phaseIdx,
      moduleId,
      projectId,
      modulesInfo: { [moduleId]: { title: modTitle } },
      moduleSnapshot: snapshot,
      stepTitles,
    });

    if (!navLevel) {
      return this.screen(md`⚠️ Проект не найден`);
    }

    const { text, keyboard } = presentNavLevel(navLevel);
    return this.screen(text, keyboard);
  }

  // ═══ Уровень 4: Урок (шаги только заголовками, закрытый уровень) ═══

  async #handleLesson(
    actor: U7BotActor,
    projectId: string,
    lessonId: string,
    courseId?: string,
    moduleId?: string,
  ): Promise<DialogResponse> {
    const loaded = await this.#loadCourses(actor, courseId);
    if (!loaded.ok) return loaded.response;
    const courses = loaded.value;
    let course = courseId
      ? courses.find((c) => c.uuid === courseId)
      : undefined;

    let foundModId = moduleId;
    let snapshot: ContentSnapshot | undefined;

    if (course && !foundModId) {
      const allModIds = course.moduleIds;
      for (const mId of allModIds) {
        const snap = await this.dispatchUc(
          CourseModuleDef,
          GetModuleSnapshotUcDef.command({ moduleId: mId }),
          actor,
        );
        if (snap.ok && snap.value.some((p) => p.projectId === projectId)) {
          foundModId = mId;
          snapshot = snap.value;
          break;
        }
      }
    }

    if (!course) {
      course = courses.find((c) => c.moduleIds.includes(foundModId ?? ''));
    }
    course ??= courses[0];
    if (!course) {
      return this.screen(md`⚠️ Курс не найден или недоступен`);
    }

    if (!foundModId) {
      const allModIds = course.moduleIds;
      for (const mId of allModIds) {
        const snap = await this.dispatchUc(
          CourseModuleDef,
          GetModuleSnapshotUcDef.command({ moduleId: mId }),
          actor,
        );
        if (snap.ok && snap.value.some((p) => p.projectId === projectId)) {
          foundModId = mId;
          snapshot = snap.value;
          break;
        }
      }
    }

    if (!foundModId) {
      return this.screen(md`⚠️ Модуль не найден или недоступен`);
    }

    const phaseIdx = stageIndexOf(course, foundModId);

    if (!snapshot) {
      const loadedSnapshot = await this.dispatchUc(
        CourseModuleDef,
        GetModuleSnapshotUcDef.command({ moduleId: foundModId }),
        actor,
      );
      if (!loadedSnapshot.ok) {
        return this.screen(md`⚠️ Модуль не найден или недоступен`);
      }
      snapshot = loadedSnapshot.value;
    }

    const project = snapshot.find((p) => p.projectId === projectId);
    if (!project) {
      return this.screen(md`⚠️ Проект не найден`);
    }

    const lesson = project.lessons.find((l) => l.lessonId === lessonId);
    if (!lesson) {
      return this.screen(md`⚠️ Урок не найден`);
    }

    let modTitle = `Модуль ${foundModId.slice(0, 8)}`;
    const mod = await this.dispatchUc(
      CourseModuleDef,
      GetModuleUcDef.command({ moduleId: foundModId }),
      actor,
    );
    if (mod.ok && mod.value.title) modTitle = mod.value.title;

    const stepTitles = await this.#loadStepTitles(actor, [lessonId]);

    const navLevel = resolveCourseNavLevel({
      level: 'lesson',
      courses,
      currentCourseId: course.uuid,
      phaseIdx,
      moduleId: foundModId,
      projectId,
      lessonId,
      modulesInfo: { [foundModId]: { title: modTitle } },
      moduleSnapshot: snapshot,
      stepTitles,
    });

    if (!navLevel) {
      return this.screen(md`⚠️ Урок не найден`);
    }

    const { text, keyboard } = presentNavLevel(navLevel);
    return this.screen(text, keyboard);
  }

  // ── Желание пройти курс (кнопка из карточки курса) ──

  async #handleApply(
    courseId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    if (!courseId) {
      return this.screen(md`⚠️ Курс не указан`);
    }

    const res = await this.dispatchUc(
      WishModuleDef,
      CreateCourseWishUcDef.command({ courseId }),
      actor,
    );
    if (res.ok) {
      if (res.value.outcome === 'questionnaire') {
        return {};
      }
      return this.screen(
        md`🎯 Твоё желание пройти курс зафиксировано\\!\n\nМы напишем тебе, когда откроется набор на этот курс\\.`,
        this.kb([[buttons.mainMenu()]]),
      );
    }
    if (res.error.code !== WishErrors.ALREADY_EXISTS.code) {
      return this.ucErrorNotify(res.error);
    }

    if (res.error.payload.status === 'pending') {
      return this.screen(
        md`📝 Ты начал заполнять анкету по этому курсу, но не закончил её\\.\nПродолжи — и желание будет закреплено\\.`,
        this.kb([
          [
            this.btn(
              '▶️ Продолжить анкету',
              Routes.questionnaire.resume(courseId),
            ),
          ],
          [buttons.mainMenu()],
        ]),
      );
    }

    const text =
      res.error.payload.status === 'confirmed'
        ? md`📚 Ты уже обучаешься на этом курсе\\.`
        : md`📝 Ты уже выразил желание пройти этот курс\\.`;
    return this.screen(
      text,
      this.kb([
        [this.btn('🗑️ Отменить желание', this.cb('cancel', courseId))],
        [buttons.mainMenu()],
      ]),
    );
  }

  // ── Запись на модуль (кнопка из уведомления о завершении) ──

  async #handleWishModule(
    moduleId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      WishModuleDef,
      CreateModuleWishUcDef.command({ moduleId }),
      actor,
    );
    if (res.ok) {
      return this.screen(
        md`✅ Записали\\! Мы сообщим, когда откроется набор на модуль\\.`,
        this.kb([[buttons.mainMenu()]]),
      );
    }
    if (res.error.code === WishErrors.ALREADY_EXISTS.code) {
      return this.screen(
        md`ℹ️ Ты уже записан на этот модуль — ждём открытия набора\\.`,
        this.kb([[buttons.mainMenu()]]),
      );
    }
    return this.ucErrorNotify(res.error);
  }

  // ── Отмена желания курса (W05) ──

  async #handleCancelConfirm(
    courseId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      WishModuleDef,
      CancelWishUcDef.command({ kind: 'course', courseId }),
      actor,
    );
    if (res.ok) {
      return this.screen(
        md`🗑️ Желание пройти курс отменено\\.`,
        this.kb([[buttons.mainMenu()]]),
      );
    }
    if (res.error.code === WishErrors.NOT_FOUND.code) {
      return this.screen(
        md`ℹ️ Активного желания на этот курс уже нет\\.`,
        this.kb([[buttons.mainMenu()]]),
      );
    }
    return this.ucErrorNotify(res.error);
  }

  // ── Отмена желания модуля (W05-M) ──

  async #handleCancelModConfirm(
    moduleId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      WishModuleDef,
      CancelWishUcDef.command({ kind: 'module', moduleId }),
      actor,
    );
    if (res.ok) {
      return this.screen(
        md`🗑️ Желание пройти модуль отменено\\.`,
        this.kb([[buttons.mainMenu()]]),
      );
    }
    if (res.error.code === WishErrors.NOT_FOUND.code) {
      return this.screen(
        md`ℹ️ Активного желания на этот модуль уже нет\\.`,
        this.kb([[buttons.mainMenu()]]),
      );
    }
    return this.ucErrorNotify(res.error);
  }

  async #handleLegacyProjectByIndex(
    actor: U7BotActor,
    moduleId: string,
    projectIdxOrId: string,
  ): Promise<DialogResponse> {
    const loadedSnapshot = await this.dispatchUc(
      CourseModuleDef,
      GetModuleSnapshotUcDef.command({ moduleId }),
      actor,
    );
    if (!loadedSnapshot.ok) {
      return this.screen(md`⚠️ Модуль не найден или недоступен`);
    }
    const snapshot: ContentSnapshot = loadedSnapshot.value;

    const idx = Number(projectIdxOrId);
    const project = Number.isNaN(idx)
      ? snapshot.find((p) => p.projectId === projectIdxOrId)
      : snapshot[idx];

    if (!project) {
      return this.screen(md`⚠️ Проект не найден`);
    }
    return this.#handleProject(actor, moduleId, project.projectId);
  }

  // ═══ Загрузка доменных данных ═══

  async #loadCourses(
    actor: U7BotActor,
    courseId?: string,
  ): Promise<LoadResult<CourseView[]>> {
    const listed = await this.dispatchUc(
      CourseModuleDef,
      ListCoursesUcDef.command({}),
      actor,
    );
    if (!listed.ok) {
      return { ok: false, response: this.ucErrorNotify(listed.error) };
    }
    const list: CourseView[] = [...listed.value];
    if (courseId && !list.some((c) => c.uuid === courseId)) {
      const loaded = await this.dispatchUc(
        CourseModuleDef,
        GetCourseUcDef.command({ courseId }),
        actor,
      );
      if (loaded.ok) list.push(loaded.value);
    }
    return { ok: true, value: list };
  }

  async #loadModulesInfo(
    actor: U7BotActor,
    moduleIds: string[],
  ): Promise<Record<string, ModuleCardInfo>> {
    const result: Record<string, ModuleCardInfo> = {};

    for (const modId of moduleIds) {
      let modTitle = `Модуль ${modId.slice(0, 8)}`;
      let projects: Array<{ title: string; lessonCount?: number }> = [];

      const mod = await this.dispatchUc(
        CourseModuleDef,
        GetModuleUcDef.command({ moduleId: modId }),
        actor,
      );
      if (mod.ok) {
        if (mod.value.title) modTitle = mod.value.title;
        projects = mod.value.projects.map((p) => ({
          title: p.title ?? 'Проект',
          lessonCount: p.lessonIds?.length ?? 0,
        }));
      }

      const snapshot = await this.dispatchUc(
        CourseModuleDef,
        GetModuleSnapshotUcDef.command({ moduleId: modId }),
        actor,
      );
      if (snapshot.ok && snapshot.value.length > 0) {
        projects = snapshot.value.map((p) => ({
          title: p.projectTitle,
          lessonCount: p.lessons?.length ?? 0,
        }));
      }

      const projectCount = projects.length;
      const lessonCount = projects.reduce(
        (sum, p) => sum + (p.lessonCount ?? 0),
        0,
      );

      result[modId] = {
        title: modTitle,
        projectCount,
        lessonCount,
        projects,
        projectTitles: projects.map((p) => p.title),
      };
    }

    return result;
  }

  async #loadStepTitles(
    actor: U7BotActor,
    lessonIds: string[],
  ): Promise<Record<string, string>> {
    if (lessonIds.length === 0) return {};
    const loaded = await this.dispatchUc(
      CourseModuleDef,
      GetStepsByLessonsUcDef.command({ lessonIds }),
      actor,
    );
    if (!loaded.ok) return {};

    const result: Record<string, string> = {};
    for (const steps of Object.values(loaded.value)) {
      for (const step of steps) {
        result[step.uuid] = withStatusIcon(step.description, step.status);
      }
    }
    return result;
  }
}
