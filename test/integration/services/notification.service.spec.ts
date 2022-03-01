import { MailService } from "../../../src/logion/services/mail.service";
import { NotificationService, templateValues, Template } from "../../../src/logion/services/notification.service";
import { configureEnvBackupRestore } from "./test-helpers/envhelper";
import { notificationData } from "../../unit/services/notification-test-data";

describe("NotificationService", () => {

    configureEnvBackupRestore();

    it("test all templates", async () => {
        const notificationService = new NotificationService(new MailService());
        for (let i=0; i<templateValues.length; i++) {
            const templateId = templateValues[i]
            await notificationService.notify(process.env.SMTP_TEST_RECIPIENT!, templateId, notificationData())
        }
    })

    it("test one template", async () => {
        const notificationService = new NotificationService(new MailService());
        const templateId: Template = "recovery-accepted";
        await notificationService.notify(process.env.SMTP_TEST_RECIPIENT!, templateId, notificationData())
    })
})
