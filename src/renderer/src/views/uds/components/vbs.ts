import { ElMessage, ElMessageBox, ElInput, ElButton, ElForm, ElFormItem } from 'element-plus'
import { ref, h } from 'vue'
import { Folder } from '@element-plus/icons-vue'

export function vbsForm(projectPath?: string) {
  const vbsFormData = ref({
    configFilePath: '',
    idlFilePath: ''
  })

  const vbsFormRules = {
    configFilePath: [{ required: true, message: 'Config File is required', trigger: 'blur' }],
    idlFilePath: [{ required: true, message: 'IDL File is required', trigger: 'blur' }]
  }
  const selectConfigFile = async (filed: string, title: string, type: string) => {
    const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
      title: title,
      properties: ['openFile'],
      filters: [{ name: 'Config Files', extensions: [type] }]
    })
    if (r.filePaths[0]) {
      //relatvie convert
      if (projectPath) {
        vbsFormData.value[filed] = window.path.relative(projectPath, r.filePaths[0])
      } else {
        vbsFormData.value[filed] = r.filePaths[0]
      }
    }
  }
  const v = h(
    ElForm,
    {
      id: 'vbs-form',
      model: vbsFormData.value,
      rules: vbsFormRules,
      labelWidth: '120px',
      labelPosition: 'top',
      size: 'small'
    },
    () => [
      h(
        ElFormItem,
        {
          label: 'Config File Path:',
          prop: 'configFilePath'
        },
        () => [
          h(
            ElInput,
            {
              modelValue: vbsFormData.value.configFilePath,
              'onUpdate:modelValue': (val: string) => (vbsFormData.value.configFilePath = val),
              disabled: true,
              placeholder: 'Select config file path',
              style: 'width: 400px;'
            },
            {
              append: () =>
                h(ElButton, {
                  icon: h(Folder),
                  onClick: () => selectConfigFile('configFilePath', 'Select Config File', 'xml')
                })
            }
          )
        ]
      ),
      h(
        ElFormItem,
        {
          label: 'IDL File Path:',
          prop: 'idlFilePath'
        },
        () => [
          h(
            ElInput,
            {
              modelValue: vbsFormData.value.idlFilePath,
              'onUpdate:modelValue': (val: string) => (vbsFormData.value.idlFilePath = val),
              disabled: true,
              placeholder: 'Select IDL file path',
              style: 'width: 400px;'
            },
            {
              append: () =>
                h(ElButton, {
                  icon: h(Folder),
                  onClick: () => selectConfigFile('idlFilePath', 'Select IDL File', 'idl')
                })
            }
          )
        ]
      )
    ]
  )
  ElMessageBox.confirm(v, 'Choose VBS Database Files', {
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    customClass: 'vbs-dialog',

    buttonSize: 'small',

    beforeClose: (action, instance, done) => {
      if (action === 'confirm') {
        v.component?.exposed?.validate((valid: boolean) => {
          if (valid) {
            done()
          } else {
            return
          }
        })
      } else {
        done()
      }
    }
  })
    .then(() => {
      //   const id = v4()
      //   layoutMaster.addWin('vbs', `${id}`, {
      //     params: {
      //       'edit-index': id,
      //       configFilePath: vbsFormData.value.configFilePath,
      //       idlFilePath: vbsFormData.value.idlFilePath
      //     }
      //   })
    })
    .catch(() => {
      // 用户取消操作
    })
}
