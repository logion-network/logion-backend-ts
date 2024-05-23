import { Log } from "@logion/rest-api-core";
import { readFileSync } from 'fs';
import { injectable } from "inversify";
import { compileTemplate, compile, Options, LocalsObject } from "pug";

import { MailService } from "./mail.service.js";

const { logger } = Log;

export type NotificationRecipient = "WalletUser" | "LegalOfficer";

export const templateValues = [
    "protection-requested",
    "protection-accepted",
    "protection-rejected",
    "protection-resubmitted",
    "protection-cancelled",
    "protection-updated",
    "recovery-requested",
    "recovery-accepted",
    "recovery-rejected",
    "recovery-resubmitted",
    "recovery-cancelled",
    "loc-requested",
    "loc-accepted",
    "loc-rejected",
    "all-documented-vars",
    "vault-transfer-requested",
    "vault-transfer-rejected",
    "vault-transfer-accepted",
    "vault-transfer-cancelled",
    "verified-issuer-dismissed",
    "verified-issuer-nominated",
    "verified-issuer-selected",
    "verified-issuer-unselected",
    "sof-requested",
    "review-requested",
    "data-reviewed",
    "recoverable-secret-added",
    "secret-recovery-requested-legal-officer",
    "secret-recovery-requested-user",
    "secret-recovery-rejected",
    "secret-recovery-accepted",
] as const;

export type Template = typeof templateValues[number];

export interface Message {
    subject: string,
    text: string,
}

type RenderFunction = compileTemplate;

interface MailTemplate {
    renderSubject: RenderFunction,
    renderText: RenderFunction
}

@injectable()
export class NotificationService {

    constructor(
        private mailService: MailService,
    ) {}

    public templatePath: string = "resources/mail"

    private templates: Map<Template, MailTemplate> = new Map<Template, MailTemplate>();

    private getMailTemplate(templateId: Template): MailTemplate {
        let mailTemplate = this.templates.get(templateId)
        if (!mailTemplate) {
            const path = `${ this.templatePath }/${ templateId }.pug`;
            logger.info("Compiling template %s", path)
            const template = readFileSync(path).toString()
            const separator = template.indexOf("\n");
            const subject = template.slice(0, separator)
            const text = template.slice(separator + 1);
            const options:Options = {
                basedir: this.templatePath,
                filename: `${ templateId }.pug`
            }
            mailTemplate = {
                renderSubject: compile(subject, options),
                renderText: compile(text, options)
            };
            this.templates.set(templateId, mailTemplate)
        }
        return mailTemplate;
    }

    async notify(to: string | undefined, templateId: Template, data: LocalsObject): Promise<void> {
        if (!to) {
            logger.warn("Cannot notify undefined recipient")
            return
        }
        const message = this.renderMessage(templateId, data);
        await this.mailService.send({ ...message, to })
            .then(success => {
                if (!success) {
                    logger.warn("User %s NOT notified of '%s'.", to, templateId);
                }
            })
            .catch(reason => logger.error("Failed to notify %s of '%s': %s", to, templateId, reason))
    }

    renderMessage(templateId: Template, data: LocalsObject): Message {
        const template: MailTemplate = this.getMailTemplate(templateId)
        return {
            subject: template.renderSubject(data),
            text: template.renderText(data)
        }
    }
}
