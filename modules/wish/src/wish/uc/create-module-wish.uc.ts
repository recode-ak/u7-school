import {
  GetModuleEnrollmentUcDef,
  type ModuleEnrollment,
} from '@u7-scl/domain/course/contract';
import {
  CreateModuleWishUcDef,
  WishAr,
  type WishModuleDef,
  type WishTargetVo,
} from '@u7-scl/domain/wish';
import { type Caller, type Identified, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type Trace,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { WishDeps } from '../../wish.module';

type ModuleTarget = Extract<WishTargetVo, { kind: 'module' }>;

/**
 * Загруженное — свои данные, контекст правила `unique`: желания пользователя
 * на этот модуль.
 */
type Loaded = {
  readonly moduleId: string;
  readonly userId: string;
  readonly target: ModuleTarget;
  readonly wishes: readonly WishAr[];
};

/** Контекст правила `moduleEnrollable` — ответ модуля курсов (D-58, `fetch`). */
type Fetched = { readonly enrollment: ModuleEnrollment };

type Input = ParsedInputOf<typeof CreateModuleWishUcDef>;

export class CreateModuleWishUc extends UseCaseFromDef<
  typeof CreateModuleWishUcDef,
  WishDeps,
  Loaded,
  Identified,
  Fetched
> {
  constructor(deps: WishDeps, module: typeof WishModuleDef) {
    super(CreateModuleWishUcDef, deps, module);
  }

  /** Свои данные: субъект, цель и желания пользователя на неё. */
  protected async load({ moduleId }: Input, caller: Caller<Identified>) {
    const userId = this.subject(caller).uuid;
    const target: ModuleTarget = { kind: 'module', moduleId };
    return ok({
      moduleId,
      userId,
      target,
      wishes: await this.resolve.wishes.findAllByUserAndTarget(userId, target),
    });
  }

  /** Ответ модуля курсов — `this.call` (фасад, D-43) после Policy (D-58). */
  protected override async fetch(
    { moduleId }: Input,
    _loaded: Loaded,
    caller: Caller<Identified>,
    trace: Trace,
  ) {
    const enrollment = await this.call(
      GetModuleEnrollmentUcDef,
      { moduleId },
      caller,
      trace,
    );
    if (!enrollment.ok) return enrollment;
    return ok({ enrollment: enrollment.value });
  }

  protected async execute(
    { moduleId }: Input,
    { userId }: Loaded,
    uow: UnitOfWork,
  ) {
    const created = WishAr.createForModule(
      { uuid: crypto.randomUUID(), userId, moduleId },
      this.now(),
    );
    if (!created.ok) return created;
    uow.register(created.value, this.resolve.wishes);
    return ok({});
  }
}
