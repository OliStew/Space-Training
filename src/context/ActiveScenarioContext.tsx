/**
 * ActiveScenarioContext.tsx
 *
 * Bridges and standardizes the scenario context across branches.
 * Re-exports the complete autonomous simulation engine from ScenarioContext,
 * providing 100% interoperability with useActiveScenario() and ActiveScenarioProvider
 * as used on the dev branch.
 */

export * from './ScenarioContext'
