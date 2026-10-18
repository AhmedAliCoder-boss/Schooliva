import "server-only";

import nodemailer from "nodemailer";

const supportInbox = process.env.SUPPORT_EMAIL_TO ?? "ahmed.ali.office70@gmail.com";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export async function sendSupportEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!from) throw new Error("SMTP_FROM or SMTP_USER must identify the support sender.");

  await createTransport().sendMail({ from, to, subject, text });
}

export async function emailSupportInbox(subject: string, text: string) {
  await sendSupportEmail({ to: supportInbox, subject, text });
}
