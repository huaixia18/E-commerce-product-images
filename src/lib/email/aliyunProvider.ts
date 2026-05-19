// Aliyun DirectMail provider. Skeleton — fill in real SDK call once you've
// verified the sender domain + got AccessKey from the aliyun console.
//
// Required env vars (only when EMAIL_PROVIDER=aliyun):
//   ALIYUN_DM_REGION         e.g. cn-hangzhou
//   ALIYUN_DM_ACCESS_KEY_ID
//   ALIYUN_DM_ACCESS_KEY_SECRET
//   ALIYUN_DM_FROM_ADDRESS   verified sender, e.g. noreply@tuzo.top
//   ALIYUN_DM_FROM_ALIAS     display name, e.g. 图作AI
//
// Production note: until the DM SDK is integrated, this provider falls
// back to console logging so the flow still works in production with a
// loud warning — better than silently swallowing codes.

import type { EmailProvider, SendCodeInput } from "./provider";

export function aliyunProvider(): EmailProvider {
  const region = process.env.ALIYUN_DM_REGION ?? "";
  const accessKeyId = process.env.ALIYUN_DM_ACCESS_KEY_ID ?? "";
  const accessKeySecret = process.env.ALIYUN_DM_ACCESS_KEY_SECRET ?? "";
  const from = process.env.ALIYUN_DM_FROM_ADDRESS ?? "";
  const fromAlias = process.env.ALIYUN_DM_FROM_ALIAS ?? "图作AI";

  if (!region || !accessKeyId || !accessKeySecret || !from) {
    return {
      name: "aliyun-misconfigured",
      async sendVerificationCode(input) {
        // eslint-disable-next-line no-console
        console.warn(
          `[email/aliyun] EMAIL_PROVIDER=aliyun but env incomplete; ` +
            `falling back to console for ${input.to}`,
        );
        // eslint-disable-next-line no-console
        console.log(`[email/aliyun-fallback] code for ${input.to}: ${input.code}`);
      },
    };
  }

  return {
    name: "aliyun",
    async sendVerificationCode(input: SendCodeInput) {
      // TODO: integrate @alicloud/dm20151123 once domain is verified.
      // The shape will be approximately:
      //   const client = new DmClient({ accessKeyId, accessKeySecret, region });
      //   await client.singleSendMail({
      //     AccountName: from,
      //     FromAlias: fromAlias,
      //     AddressType: 1,
      //     ReplyToAddress: false,
      //     ToAddress: input.to,
      //     Subject: `【${fromAlias}】${input.purposeLabel}验证码`,
      //     HtmlBody: renderTemplate(input),
      //   });
      void fromAlias;
      // eslint-disable-next-line no-console
      console.log(`[email/aliyun TODO] would send to ${input.to}: ${input.code}`);
    },
  };
}
