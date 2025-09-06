# 安装

您可以从 [GitHub releases 页面](https://github.com/ecubus/EcuBus-Pro/releases) 下载最新版本的 `EcuBus-Pro`
或者如果您在中国❤️，可以从我们的 CDN 页面下载：<CustomComponent/>

> [!TIP]
> Linux, macOS 版本只能自行从Release页面下载，Arch Linux 可以通过 AUR 仓库安装。

> [!TIP]
> Windows 的最低版本是 Windows 10，但我们推荐使用 Windows 11。

## Windows 安装指南

![alt text](../../media/about/image.png)

### 您可以选择为所有人安装或仅为自己安装

![alt text](../../media/about/image-1.png)

### 当您打开 `EcuBus-Pro` 时可以看到详细信息

![alt text](../../media/about/image-2.png)

## 自动更新

当您打开 `EcuBus-Pro` 时，它会检查最新版本，如果有新版本，会提示您更新。
![alt text](../../media/about/update1.png)

- 您可以查看详细的更新信息，点击 `开始更新` 按钮进行更新。
  ![alt text](../../media/about/update2.png)

- 将显示更新进度，请稍等片刻。
  ![alt text](../../media/about/update3.png)

- 更新完成后，您可以点击 `重启` 按钮重启 `EcuBus-Pro`。

## Arch Linux 安装指南

通过 [AUR 仓库](https://aur.archlinux.org/packages/ecubus-pro)或[自建源仓库](https://github.com/taotieren/aur-repo)安装。

```bash
# AUR
yay -Syu ecubus-pro
# 或自建源
sudo pacman -Syu ecubus-pro
```

<script setup>
import CustomComponent from './../../component/download.vue'
</script> 
