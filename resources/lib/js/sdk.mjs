import { reactive as o, watch as d } from "vue";
const i = o(window.$wujie?.props?.modelValue ?? {});
d(i, (e) => {
  window.$wujie.bus.$emit("update:modelValue", {
    pluginId: window.$wujie?.props?.pluginId,
    id: window.$wujie?.props?.editIndex,
    data: e
  });
});
function p() {
  return i;
}
const t = window.parent.logBus;
function u(e, ...n) {
  return window.parent.electron.ipcRenderer.invoke(
    "ipc-plugin-exec",
    { pluginId: window.$wujie?.props?.pluginId, id: window.$wujie?.props?.editIndex },
    e,
    ...n
  );
}
export {
  u as callServerMethod,
  t as eventBus,
  p as useData
};
//# sourceMappingURL=index.mjs.map
