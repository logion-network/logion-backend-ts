import { NotificationService, templateValues } from "../../../src/logion/services/notification.service";
import { MailService, MailMessage } from "../../../src/logion/services/mail.service";
import { Mock, It } from "moq.ts";
import { notifiedProtection, notificationData } from "./notification-test-data";
import { writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from 'os';

describe("NotificationService", () => {

    const to = "someone@example.org";
    let mailService: Mock<MailService>;
    let notificationService: NotificationService;

    beforeEach(() => {
        mailService = new Mock<MailService>()
        mailService
            .setup(instance => instance.send(It.Is<MailMessage>(mailMessage => mailMessage.to === to)))
            .returns(Promise.resolve(true))
        notificationService = new NotificationService(mailService.object());
    })

    it("renders message", () => {

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

        notificationService.templatePath = "resources/mail";
        const message = notificationService.renderMessage("all-documented-vars", notificationData());
        expect(message.subject).toEqual("All possible variables")
        const actualText = message.text;
        expect(actualText).not.toContain("undefined")
    })

    it("renders all templates to /tmp", () => {
        const dir = mkdtempSync(tmpdir() + "/logion-mail-")
        console.log("Generating all templates to %s", dir)
        notificationService.templatePath = "resources/mail";
        for (let i = 0; i < templateValues.length; i++) {
            const templateId = templateValues[i]
            const message = notificationService.renderMessage(templateId, notificationData());
            const file = `${ dir }/${ templateId }.txt`
            writeFileSync(file, message.subject + "\n" + message.text)
        }
    })

    it("notifies by mail", () => {
        notificationService.templatePath = "test/resources/mail";
        notificationService.notify(to, "protection-requested", {
            protection: notifiedProtection,
            walletUser: notifiedProtection.userIdentity
        })
        mailService
            .verify(instance => instance.send(It.Is<MailMessage>(mailMessage => mailMessage.to === to)))
    })

    it("renders included file", () => {
        notificationService.templatePath = "test/resources/mail";
        const message = notificationService.renderMessage("protection-accepted", { info: "footer" });
        expect(message.subject).toEqual("Your protection is accepted.")
        expect(message.text).toEqual([
            "Your protection is accepted.",
            "This is the footer.",
            ""
        ].join("\n"))
    })

    it("renders conditional (if)", () => {
        notificationService.templatePath = "test/resources/mail";
        let message = notificationService.renderMessage(
            "loc-requested",
            { loc: { requesterAddress: "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY" } });
        expect(message.subject).toEqual("SUBJECT")
        expect(message.text).toEqual([
            "Begin",
            "Identification key:",
            "5H4MvAsobfZ6bBCDyj5dsrWYLrA8HrRzaqa9p61UXtxMhSCY",
            "End."
        ].join("\n"))
    })

    it("renders conditional (else if)", () => {
        notificationService.templatePath = "test/resources/mail";
        const message = notificationService.renderMessage(
            "loc-requested",
            { loc: { requesterIdentityLoc: "81342986-8999-4d1e-86fb-d0ce96566708" } });
        expect(message.subject).toEqual("SUBJECT")
        expect(message.text).toEqual([
            "Begin",
            "Identification LOC:",
            "81342986-8999-4d1e-86fb-d0ce96566708",
            "End."
        ].join("\n"))

    })
})
