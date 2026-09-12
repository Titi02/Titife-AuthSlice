import nodemailer from "nodemailer";

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
}

// Gmail SMTP. Requires an App Password (not the account password) in SMTP_PASS
// when 2-Step Verification is enabled on the account.
const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const SMTP_SECURE = process.env.SMTP_SECURE !== "false";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM;

export async function sendEmail({
  to,
  subject,
  text,
}: SendEmailParams): Promise<void> {
  if (!SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new Error(
      "Email is not configured. Set SMTP_USER, SMTP_PASS and SMTP_FROM. For Gmail, SMTP_USER is your Gmail address and SMTP_PASS is an App Password."
    );
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
  });
}
