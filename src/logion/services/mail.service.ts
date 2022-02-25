import { injectable } from "inversify";
import { createTransport } from "nodemailer";
import { Options as TransportOptions } from "nodemailer/lib/smtp-connection";
import Mail from "nodemailer/lib/mailer";
import { Log } from "../util/Log";

const { logger } = Log;

export interface MailMessage {
    to: string,
    subject: string,
    text: string,
}

@injectable()
export class MailService {

    constructor() {
        this.enabled = process.env.SMTP_ENABLED === "true";
        this.transportOptions = {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "465", 10),
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWD,
                method: 'login'
            },
            secure: true,
            logger: process.env.SMTP_LOGGER === "true"
        }
        if (this.enabled) {
            logger.info("MailService running with smtp server: %s", this.transportOptions.host)
        } else {
            logger.warn("MailService is disabled")
        }
    }

    private readonly transportOptions: TransportOptions
    private readonly enabled: boolean;

    async send(message: MailMessage): Promise<boolean> {
        if (!this.enabled) {
            logger.warn("Mail sending is disabled.\nTo enable it, please set env variable SMTP_ENABLED to true.")
            return true
        }
        const { to, subject, text } = message
        try {
            const transport = createTransport(this.transportOptions);
            const mail: Mail.Options = {
                from: process.env.SMTP_FROM,
                to,
                subject,
                text
            }
            const info = await transport.sendMail(mail);
            logger.info("Message <%s> '%s' sent to %s", info.messageId, subject, info.accepted.join(","))
            return true
        } catch (e) {
            logger.warn("Failed to send email to %s: %s", to, e)
            return false
        }
    }

}
