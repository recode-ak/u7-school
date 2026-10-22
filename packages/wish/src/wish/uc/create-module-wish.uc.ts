// DEBT-21, DEBT-22: субъект вызывающего — legacy `User` (`@u7-scl/app`).
import type { User } from '@u7-scl/app/domain';
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
import { type Caller, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type Trace,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { WishDeps } from '../../wish.module';

type ModuleTarget = Extract<WishTargetVo, { kind: 'module' }>;

/**
 * Загруженное — контекст правил `moduleEnrollable` и `unique`: ответ
 * модуля курсов о записи и желания пользователя на этот модуль.
 */
type Loaded = {
  readonly moduleId: string;
  readonly enrollment: ModuleEnrollment;
  readonly userId: string;
  readonly target: ModuleTarget;
  readonly wishes: readonly WishAr[];
};

type Input = ParsedInputOf<typeof CreateModuleWishUcDef>;

export class CreateModuleWishUc extends UseCaseFromDef<
  typeof CreateModuleWishUcDef,
  WishDeps,
  Loaded,
  User
> {
  constructor(deps: WishDeps, module: typeof WishModuleDef) {
    super(CreateModuleWishUcDef, deps, module);
  }

  /** Ответ курсов — `this.call` (D-43), желания — все на эту цель. */
  protected async load(
    { moduleId }: Input,
    caller: Caller<User>,
    trace: Trace,
  ) {
    const enrollment = await this.call(
      GetModuleEnrollmentUcDef,
      { moduleId },
      caller,
      trace,
    );
    if (!enrollment.ok) return enrollment;
    const userId = this.subject(caller).uuid;
    const target: ModuleTarget = { kind: 'module', moduleId };
    return ok({
      moduleId,
      enrollment: enrollment.value,
      userId,
      target,
      wishes: await this.resolve.wishes.findAllByUserAndTarget(userId, target),
    });
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
