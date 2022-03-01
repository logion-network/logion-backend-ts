import { config } from "dotenv";

let backupEnv: NodeJS.ProcessEnv;

/**
 * <p>
 * When called in the context of jasmine tests,
 * performs the following operations:
 * </p>
 * <p>
 * Before test execution:
 * </p>
 * - Backup the current environment (process.env)
 * - Set the process env according to .env file located at the root of this project.
 * <p>
 * After test execution:
 * </p>
 * - Restore the previously backed up env.
 * </p>
 */
export function configureEnvBackupRestore() {

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

}
