// dmg-core/graph — нормализация Def и граф домена L0/L1/L2 (документация,
// MCP, проверки архитектуры).

export { type DefIndex, indexDefs } from './def-index';
export {
  type AggregateNode,
  buildGraph,
  type DomainGraph,
  type DomainRuleNode,
  type ErrorNode,
  type EventNode,
  type JobNode,
  type ModuleLink,
  type ModuleNode,
  type ReactionNode,
  type UseCaseNode,
} from './domain-graph';
export {
  type AnyDef,
  type NormalizedAggregate,
  type NormalizedDef,
  type NormalizedDomainRule,
  type NormalizedError,
  type NormalizedEvent,
  type NormalizedEventReaction,
  type NormalizedFacade,
  type NormalizedJob,
  type NormalizedModule,
  type NormalizedPolicy,
  type NormalizedRule,
  type NormalizedRules,
  type NormalizedUseCase,
  normalize,
} from './normalize';
