import { readFileSync } from 'fs';
import { render } from "squirrelly";
import { MailService } from "./mail.service";
import { Log } from "../util/Log";
import { injectable } from "inversify";

const { logger } = Log;

export type Template =
    "protection-requested" |
    "protection-accepted" |
    "protection-rejected" |
    "recovery-requested" |
    "recovery-accepted" |
    "recovery-rejected"

export interface Message {
    subject: string,
    text: string,
}

@injectable()
export class NotificationService {

    constructor(
        private mailService: MailService,
    ) {}

    public templatePath: string = "resources/mail"

    notify(to: string | undefined, templateId: Template, data: any): void {
        if (!to) {
            logger.warn("Cannot notify undefined recipient")
            return
        }
        const message = this.renderMessage(templateId, data);
        this.mailService.send({ ...message, to })
            .then(success => {
                if (!success) {
                    logger.warn("User %s NOT notified of '%s'.", to, templateId);
                }
            })
    }

    renderMessage(templateId: Template, data: any): Message {
        const template = readFileSync(`${this.templatePath}/${templateId}.txt`).toString()
        const separator = template.indexOf("\n");
        const subject = template.slice(0, separator)
        const text = template.slice(separator + 1);
        return {
            subject: render(subject, data),
            text: render(text, data)
        }
    }
}
