/** Script nodes that global start and CLI should launch. Test configs and disabled nodes stay off. */
export function isRunnableScriptNode(node: { isTest?: boolean; disabled?: boolean }): boolean {
  return !node.isTest && !node.disabled
}
