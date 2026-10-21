// TR-11: фасад по D-42 над UC-адаптером legacy-модуля курсов.
import {
  type CourseModuleDef,
  type CourseModuleFacade,
  GetCourseEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import { callUseCase, type UseCaseOwner } from 'dmg-core/app';

/**
 * In-proc реализация фасада курсов по D-42 (API-04): каждый метод — вызов
 * UC модуля от вызывающего `module`, доменных решений нет. UC — адаптеры
 * над legacy (TR-11). Приложение собирает фасад поверх `createCourseModule`
 * и передаёт его в резолвер модуля-потребителя (у того `course` в
 * `dependsOn`, UC — в `calls`).
 */
export function courseModuleFacade(
  course: UseCaseOwner<typeof CourseModuleDef>,
): CourseModuleFacade {
  return {
    getCourseEnrollment: (call, courseId) =>
      callUseCase(course, GetCourseEnrollmentUcDef, { courseId }, call),
  };
}
