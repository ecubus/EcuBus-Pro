import { reactive as r, watch as p } from "vue";
async function d(n) {
  return window.parent.electron.ipcRenderer.invoke("ipc-show-open-dialog", n);
}
async function w(n) {
  return window.parent.electron.ipcRenderer.invoke("ipc-show-save-dialog", n);
}
const o = r(window.$wujie?.props?.modelValue ?? {});
p(o, (n) => {
  window.$wujie.bus.$emit("update:modelValue", {
    pluginId: window.$wujie?.props?.pluginId,
    id: window.$wujie?.props?.editIndex,
    data: n
  });
});
function t() {
  return o;
}
const i = window.parent.logBus;
function l(n, ...e) {
  return window.parent.electron.ipcRenderer.invoke(
    "ipc-plugin-exec",
    { pluginId: window.$wujie?.props?.pluginId, id: window.$wujie?.props?.editIndex },
    n,
    ...e
  );
}
function a(n, e) {
  i.on(`pluginEvent.${window.$wujie?.props?.pluginId}.${n}`, e);
}
function s(n, e) {
  i.off(`pluginEvent.${window.$wujie?.props?.pluginId}.${n}`, e);
}
function c(n) {
  i.on(`pluginError.${window.$wujie?.props?.pluginId}`, n);
}
function g(n) {
  i.off(`*pluginError.${window.$wujie?.props?.pluginId}`, n);
}
export {
  c as addPluginErrorListen,
  a as addPluginEventListen,
  l as callServerMethod,
  i as eventBus,
  g as removePluginErrorListen,
  s as removePluginEventListen,
  d as showOpenDialog,
  w as showSaveDialog,
  t as useData
};
//# sourceMappingURL=index.mjs.map
