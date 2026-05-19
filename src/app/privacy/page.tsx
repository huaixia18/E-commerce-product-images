import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "隐私政策 · 图作AI" };

const UPDATED = "2026-05-19";

export default function PrivacyPage() {
  return (
    <main className="flex-1 bg-background">
      <article className="mx-auto max-w-3xl px-6 py-12 prose prose-zinc dark:prose-invert">
        <Link
          href="/"
          className="not-prose inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          返回首页
        </Link>
        <h1 className="text-3xl font-black tracking-tight">隐私政策</h1>
        <p className="text-sm text-muted-foreground">最近更新：{UPDATED}</p>

        <p>
          我们重视您的个人信息保护。本政策说明我们在您使用「图作AI」过程中收集、使用、存储、共享您信息的方式与目的。
        </p>

        <h2>一、我们收集的信息</h2>

        <h3>1. 您主动提供的信息</h3>
        <ul>
          <li>账号信息：邮箱地址、昵称、密码（加密存储，不以明文形式保存）</li>
          <li>支付信息：充值金额、套餐选择（不存储您的银行卡号 / 微信支付宝完整账号）</li>
          <li>生成任务信息：您上传的商品图、填写的卖点文案、产品参数等</li>
        </ul>

        <h3>2. 自动收集的信息</h3>
        <ul>
          <li>设备信息：浏览器 User-Agent、操作系统、屏幕尺寸（用于反作弊与体验优化）</li>
          <li>访问日志：IP 地址、访问时间、操作记录（保留 30-90 天，用于安全审计）</li>
          <li>Cookies：会话登录态，关闭浏览器或退出登录后自动清除</li>
        </ul>

        <h2>二、我们如何使用您的信息</h2>
        <ol>
          <li>提供服务：识别您的账号、处理生成任务、记录积分与订单</li>
          <li>账号安全：验证身份、防止盗号、检测异常登录</li>
          <li>反作弊：识别批量注册、刷邀请奖励等行为</li>
          <li>服务改进：分析使用数据以优化产品体验（不针对个人，仅做聚合统计）</li>
          <li>与您沟通：发送账号验证码、充值通知、服务变更通知</li>
        </ol>

        <h2>三、信息存储与安全</h2>
        <ol>
          <li>您的数据存储在位于中国大陆的服务器（数据库 + 阿里云对象存储 OSS）</li>
          <li>密码使用 bcrypt 单向哈希存储，我们无法获知您的明文密码</li>
          <li>支付通过第三方支付服务商完成，敏感金融信息不经过我们的服务器</li>
          <li>我们采取合理的技术与管理措施保护您的数据，但不能绝对保证 100% 安全</li>
        </ol>

        <h2>四、信息共享与披露</h2>
        <p>
          我们不会向无关第三方出售您的个人信息。在以下情形下我们可能共享必要信息：
        </p>
        <ul>
          <li>
            <strong>AI 服务提供方</strong>：为完成图片生成任务，您上传的商品图与提示词将传送至上游 AI 服务（OpenAI / BananaRouter）。这些数据仅用于完成本次生成任务。
          </li>
          <li>
            <strong>对象存储服务</strong>：您的商品图与生成结果存储在阿里云 OSS。
          </li>
          <li>
            <strong>支付服务商</strong>：充值时您的订单号、金额会传至微信支付 / 支付宝以完成扣款。
          </li>
          <li>
            <strong>法律要求</strong>：在司法机关、行政机关依法定程序要求披露时，我们会依法配合。
          </li>
        </ul>

        <h2>五、您的权利</h2>
        <p>您对自己的个人信息享有以下权利：</p>
        <ul>
          <li><strong>查询</strong>：登录账号即可查看您的全部资料、订单、生成记录</li>
          <li><strong>修改</strong>：通过「账号设置」修改昵称、邮箱、密码</li>
          <li><strong>删除</strong>：如需删除账号及关联数据，请通过账号绑定邮箱与我们联系（一般在 7 个工作日内完成）</li>
          <li><strong>导出</strong>：您可通过下载 zip 导出全部生成结果</li>
        </ul>

        <h2>六、未成年人保护</h2>
        <p>
          本服务面向具有完全民事行为能力的成年人。若您未满 18 周岁，请在监护人陪同下阅读本政策并取得监护人同意后使用本服务。
        </p>

        <h2>七、Cookie 使用</h2>
        <p>
          我们使用 Cookie 维持您的登录状态、记录少量偏好。这些 Cookie 不包含您的明文密码或支付信息。您可在浏览器中禁用 Cookie，但部分功能将无法正常使用。
        </p>

        <h2>八、政策变更</h2>
        <p>
          本政策可能不时更新。重大变更将通过站内公告或邮件通知您。建议您定期查阅本政策的最新版本。
        </p>

        <h2>九、联系我们</h2>
        <p>
          如对本政策有任何疑问、投诉或建议，您可通过账号绑定邮箱与我们联系。
        </p>

        <hr />
        <p className="text-sm text-muted-foreground">
          请同时阅读{" "}
          <Link href="/terms" className="text-primary hover:underline">
            《用户协议》
          </Link>。
        </p>
      </article>
    </main>
  );
}
