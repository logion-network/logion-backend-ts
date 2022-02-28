import { NotificationService } from "../../../src/logion/services/notification.service";
import { MailService, MailMessage } from "../../../src/logion/services/mail.service";
import { Mock, It } from "moq.ts";
import { notifiedProtection, notificationData } from "./notification-test-data";

describe("NotificationService", () => {

    it("renders message", () => {

        const mailService = new Mock<MailService>().object()
        const notificationService = new NotificationService(mailService);
        notificationService.templatePath = "test/resources/mail";
        const message = notificationService.renderMessage("protection-requested", {
            protection: notifiedProtection,
            walletUser: notifiedProtection.userIdentity
        });
        expect(message.subject).toEqual("Your protection is requested")
        const actualText = message.text;
        const expectedText = [
            "Dear Legal Officer,",
            "The following user has requested your protection:",
            "John Doe(5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY)",
            ""
        ].join("\n")
        expect(actualText.length).toEqual(expectedText.length)
        expect(actualText).toEqual(expectedText)
    })

    it("renders message with all documented vars", () => {

        const mailService = new Mock<MailService>().object()
        const notificationService = new NotificationService(mailService);
        const message = notificationService.renderMessage("all-documented-vars", notificationData());
        expect(message.subject).toEqual("All possible variables")
        const actualText = message.text;
        expect(actualText).not.toContain("undefined")
    })

    it("notifies by mail", () => {
        const to = "someone@example.org";
        const mailService = new Mock<MailService>()
        mailService
            .setup(instance => instance.send(It.Is<MailMessage>(mailMessage => mailMessage.to === to)))
            .returns(Promise.resolve(true))
        const notificationService = new NotificationService(mailService.object());
        notificationService.templatePath = "test/resources/mail";
        notificationService.notify(to, "protection-requested", {
            protection: notifiedProtection,
            walletUser: notifiedProtection.userIdentity
        })
        mailService
            .verify(instance => instance.send(It.Is<MailMessage>(mailMessage => mailMessage.to === to)))
    })
})
