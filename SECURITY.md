# 安全漏洞报告 / Security policy

请不要在公开 Issue、Pull Request 或讨论中发布漏洞利用细节、访问令牌、会话 Cookie、密码、重置链接或真实客户数据。

在本项目的 GitHub 仓库启用私密漏洞报告后，请通过 **Security → Report a vulnerability** 联系维护者。若该入口不可用，请先提交不包含漏洞细节的普通 Issue，请求维护者提供私密联系渠道；取得渠道后再发送详细报告。本仓库没有声明固定安全邮箱或响应时限。

私密报告请包含前端和后端的版本或提交号、影响范围、脱敏复现步骤、预期行为与实际行为，以及可能的修复方向。使用隔离测试数据；不要向维护者发送生产凭据或完整业务数据。

安全修复应同时核对配套后端契约与前端依赖。当前未承诺历史版本的维护期限；部署者应采用包含已公布修复的版本，并关注依赖安全公告。

## 部署边界

- 前端权限控制只负责交互体验，后端仍必须独立验证成员资格、租户、权限、记录范围与字段策略。
- 开发身份只用于显式启用的本地开发或测试环境，不能进入生产构建。
- `VITE_*` 配置会进入浏览器环境，不能保存任何秘密；会话由后端 Cookie 管理。
- HTTPS、同源反向代理与后端安全配置见 [部署说明](docs/deployment.md)，已实现边界见 [安全记录](docs/security.md)。

## English

Do not disclose vulnerabilities or credentials in public issues or pull requests. Use **Security → Report a vulnerability** on the project's GitHub repository when private reporting is enabled. If unavailable, open an issue containing no vulnerability details to request a private contact channel. Include frontend and backend versions, impact, and sanitized reproduction steps in the private report. No fixed response time or historical-version support period is promised.
