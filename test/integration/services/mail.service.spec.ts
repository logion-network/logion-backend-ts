import { MailService } from "../../../src/logion/services/mail.service";
import { v4 } from "uuid";
import { config } from "dotenv"

describe("MailService", () => {

    let backupEnv: NodeJS.ProcessEnv;

    beforeAll(() => {
        // Save the current environment.
        backupEnv = process.env
        // Read .env at the root of the project.
        config();
    })

    afterAll(() => {
        // Restore previously saved environment.
        process.env = backupEnv
    })

    it("sends an email", async () => {

        const mailService = new MailService();

        const success = await mailService.send({
            to: process.env.SMTP_TEST_RECIPIENT!,
            subject: "Test Email " + v4(),
            text: "This is the text of the email;"
        })
        if (!success) {
            console.log("MailService does not seem to be properly configured.")
            console.log("Please review the sample config in '.env.sample' and adapt your own '.env' accordingly.")
        }
        expect(success).toBeTrue()
    })
})
