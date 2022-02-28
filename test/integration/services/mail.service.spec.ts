import { MailService } from "../../../src/logion/services/mail.service";
import { v4 } from "uuid";
import { configureEnvBackupRestore } from "./test-helpers/envhelper";

describe("MailService", () => {

    configureEnvBackupRestore();

    it("sends an email", async () => {

        const mailService = new MailService();

        const success = await mailService.send({
            to: process.env.SMTP_TEST_RECIPIENT!,
            subject: "Test Email " + v4(),
            text: "This is the text of the email with some emojis: 👍 🙂"
        })
        if (!success) {
            console.log("MailService does not seem to be properly configured.")
            console.log("Please review the sample config in '.env.sample' and adapt your own '.env' accordingly.")
        }
        expect(success).toBeTrue()
    })
})
