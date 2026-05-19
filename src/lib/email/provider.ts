// Abstract email sender. Today we ship a console provider (logs to stderr
// and stores nothing extra) and an Aliyun DirectMail provider stub that
// activates once EMAIL_PROVIDER=aliyun + ALIYUN_DM_* env vars are set.
//
// Adding a new provider: implement EmailProvider and wire it up in
// emailProvider() below.

export interface SendCodeInput {
  to: string;
  code: string;
  ttlMinutes: number;
  /** Display purpose, e.g. "注册账号" / "重置密码" */
  purposeLabel: string;
}

export interface EmailProvider {
  readonly name: string;
  sendVerificationCode(input: SendCodeInput): Promise<void>;
}

const consoleProvider: EmailProvider = {
  name: "console",
  async sendVerificationCode(input) {
    // Visible in dev terminal so the human running the app can grab the code.
    // In production this provider should never be used — it intentionally
    // logs codes in plaintext.
    // eslint-disable-next-line no-console
    console.log(
      `\n[email/console] → ${input.to}\n` +
        `  purpose: ${input.purposeLabel}\n` +
        `  code:    ${input.code} (${input.ttlMinutes} min)\n`,
    );
  },
};

let _provider: EmailProvider | null = null;

export function emailProvider(): EmailProvider {
  if (_provider) return _provider;
  const kind = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();
  if (kind === "aliyun") {
    // Lazy-load to avoid pulling in the SDK during build when not configured.
    // The aliyun provider validates its env vars and falls back to console
    // with a warning if anything is missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { aliyunProvider } = require("./aliyunProvider") as typeof import("./aliyunProvider");
    _provider = aliyunProvider();
  } else {
    _provider = consoleProvider;
  }
  return _provider;
}
