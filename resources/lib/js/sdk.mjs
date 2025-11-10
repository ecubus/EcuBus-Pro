import { reactive as t, watch as u } from "vue";
async function p(n) {
  return window.parent.electron.ipcRenderer.invoke("ipc-show-open-dialog", n);
}
async function d(n) {
  return window.parent.electron.ipcRenderer.invoke("ipc-show-save-dialog", n);
}
let o = !1;
const r = t(window.$wujie?.props?.dataStore ?? {});
u(
  r,
  (n) => {
    if (o) {
      o = !1;
      return;
    }
    window.$wujie?.bus && (console.log("pluginEmit"), window.$wujie.bus.$emit("update:dataStore", n));
  },
  { deep: !0 }
);
window.$wujie?.bus && window.$wujie.bus.$on("update:dataStore:fromMain", (n) => {
  o = !0, Object.assign(r, n || {});
});
function a() {
  return r;
}
const i = window.parent.logBus;
function s(n, ...e) {
  return window.parent.electron.ipcRenderer.invoke(
    "ipc-plugin-exec",
    { pluginId: window.$wujie?.props?.pluginId, id: window.$wujie?.props?.editIndex },
    n,
    ...e
  );
}
function l(n, e) {
  i.on(`pluginEvent.${window.$wujie?.props?.pluginId}.${n}`, e);
}
function c(n, e) {
  i.off(`pluginEvent.${window.$wujie?.props?.pluginId}.${n}`, e);
}
function g(n) {
  i.on(`pluginError.${window.$wujie?.props?.pluginId}`, n);
}
function f(n) {
  i.off(`*pluginError.${window.$wujie?.props?.pluginId}`, n);
}
export {
  g as addPluginErrorListen,
  l as addPluginEventListen,
  s as callServerMethod,
  i as eventBus,
  f as removePluginErrorListen,
  c as removePluginEventListen,
  p as showOpenDialog,
  d as showSaveDialog,
  a as useData
};
//# sourceMappingURL=index.mjs.map
