# OrcaRouter 提供商

EcuBus-Pro 可以使用 [OrcaRouter](https://www.orcarouter.ai) 作为 AI 提供商。
OrcaRouter 是面向模型与 Agent 的 OpenAI 兼容 AI 网关。有两种接入方式，二者相互独立，
可按所在机器的条件任选其一。

| 方式 | **Home → AI** 中的名称 | 凭据 |
| --- | --- | --- |
| 现有密钥 | **OrcaRouter - API** | 粘贴 `sk-orca-…` 密钥。 |
| 账号登录 | **OrcaRouter - Auth** | 通过浏览器登录获取 `sk-orca-…` 密钥。 |

两种方式得到的是同一类密钥，推理请求都发往 `https://api.orcarouter.ai/v1`。
它们不能互相替代：无法进行浏览器登录的机器可用 API Key，手头没有密钥时可用账号登录。

## 使用 API Key 接入

1. 在 <https://www.orcarouter.ai/console/authorized-apps> 创建密钥。
2. 打开 **Home → AI → OrcaRouter - API**。
3. 粘贴密钥并点击 **Save key**。

密钥使用应用已有的受保护存储保存（Electron `safeStorage`，在可用时由操作系统钥匙串支撑）。
保存后不会再显示明文，面板只显示掩码占位符。点击 **Clear** 可清除。

面板中的控制台链接同时也是撤销密钥的入口。

## 使用 OrcaRouter 账号接入

1. 打开 **Home → AI → OrcaRouter - Auth**。
2. 点击 **Connect with OrcaRouter**，浏览器会打开 OrcaRouter 授权页。
3. 同意授权。浏览器会回调到本机的回环地址，密钥自动保存，无需手动复制。

该流程使用 OAuth 2.0 + PKCE（`S256`）与回环重定向。不需要 client secret，也不需要预先
注册重定向 URI：应用在本机 `127.0.0.1` 上绑定临时端口，OrcaRouter 将授权码回传到该地址。
授权码有效期十分钟且只能使用一次。

授权页也提供“显示验证码”选项。应用始终发送 `S256`，因此即使验证码显示在屏幕上，也只有
发起登录的那个进程能够兑换它。

若浏览器未自动打开，面板会显示授权 URL，可自行打开。

### 凭据的保存与有效期

登录得到的是一个普通的、长期有效的 OrcaRouter API Key，归你的账号所有：计入你的账单、
显示在你的控制台，并可随时撤销。

OrcaRouter **不签发** refresh token，也没有刷新接口。因此应用会一直复用已保存的密钥，
直到 OrcaRouter 将其撤销；不会在每次启动时重新授权——OrcaRouter 限制每个用户每 24 小时
最多签发 10 个 PKCE 密钥，每次启动都重新授权会很快触发限制。

当请求因未授权被拒绝时，应用会把该凭据标记为需要重新认证并提示重新登录。它不会在首次失败
时删除已保存的密钥，也不会循环重试。

可刷新的 OAuth 令牌会自动轮换；OrcaRouter 这类持久密钥授权则一直复用，直到提供商撤销。

## 选择模型

模型下拉列表来自你的账号实际可调用的模型。列表通过已保存的密钥实时请求
`GET https://api.orcarouter.ai/v1/models` 获得，因此反映的是你的工作区，而不是硬编码清单。
点击 **Refresh** 可重新获取。

模型 ID 保留厂商命名空间（`anthropic/claude-opus-4.8`、`openai/gpt-5.5` 等），无需手动输入。

列表会按当前请求能力过滤：

- **文本**请求只提供可服务对话的模型。
- 打开 **Attach an image** 后，列表收窄为明确声明支持图片输入的对话模型。未声明图片能力的
  模型不会出现在图片请求的下拉中；已选模型若不再符合条件会被清空，需重新选择。

若无法访问模型目录，下拉会回退到一份少量的已验证清单，并显示 **Degraded** 标记与原因。
它不会退化成自由文本输入，实时结果也绝不会与回退清单混合。

## 配置

| 配置项 | 环境变量 | 默认值 |
| --- | --- | --- |
| 认证 | `ORCA_AUTH_BASE_URL` | `https://www.orcarouter.ai` |
| 推理与模型目录 | `ORCA_API_BASE_URL` | `https://api.orcarouter.ai` |
| 两者同时 | `ORCA_BASE_URL` | *(未设置)* |

显式的单项配置优先；`ORCA_BASE_URL` 是共享回退值，仅用于未显式设置的那一项，单域名的自托管
部署即使用该方式。远程地址必须使用 HTTPS，明文 HTTP 仅允许用于回环开发。

两个 origin 不会互相推导。认证位于认证 origin 的 `/auth` 与 `/api/v1/auth/keys`；推理与
模型发现位于 API origin 的 `/v1` 之下，且绝不用于认证。

## 密钥存放位置

密钥保存在应用的主进程中，绝不会发送到渲染进程、浏览器上下文、日志、分析事件或错误信息。
所有推理与模型发现请求都在主进程中发出。
