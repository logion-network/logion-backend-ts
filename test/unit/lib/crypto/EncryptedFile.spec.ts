import os from 'os';
import path from 'path';
import { EncryptedFileWriter, EncryptedFileReader } from "../../../../src/logion/lib/crypto/EncryptedFile.js";
import { existsSync, readFileSync } from "fs";
import { rm } from "fs/promises";

const tempFileName = path.join(os.tmpdir(), "logion-pg-backup-manager-encrypted-file.dat");
const clearText = "Some clear text";
const password = "secret";

describe("EncryptedFile", () => {

    it("encrypts and decrypts properly", async () => {
        const writer = new EncryptedFileWriter();
        await writer.open(tempFileName, password);
        await writer.write(Buffer.from(clearText, 'utf-8'));
        await writer.close();

        const reader = new EncryptedFileReader();
        await reader.open(tempFileName, password);
        const data = await reader.readAll();
        await reader.close();

        expect(data.toString("utf-8")).toBe(clearText);
    });

    it("encrypts to file", async () => {
        const writer = new EncryptedFileWriter();
        const clearFile = "test/unit/lib/crypto/assets.png";
        const encryptedFile = await writer.encrypt({ clearFile, keepSource: true, password });
        expect(existsSync(encryptedFile)).toBeTrue();

        const clearFileContent = readFileSync(clearFile);
        const encryptedFileContent = readFileSync(encryptedFile);
        expect(clearFileContent).not.toEqual(encryptedFileContent)

        const reader = new EncryptedFileReader();
        const decryptedFile = await reader.decrypt( { encryptedFile, keepSource: true, password });
        expect(existsSync(decryptedFile)).toBeTrue();

        const decryptedFileContent = readFileSync(decryptedFile)
        expect(decryptedFileContent).toEqual(clearFileContent)

        await rm(encryptedFile)
        await rm(decryptedFile)
    })
});
