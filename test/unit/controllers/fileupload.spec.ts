import { UploadedFile } from "express-fileupload";
import { writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { getUploadedFile } from "../../../src/logion/controllers/fileupload.js";

describe("getUploadedFile", () => {

    it("properly handles latin1-encoded file names", async () => {
        await withUploadedContent("data");
        const receivedHash = "0x3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7";
        const fileName = "éééé.txt";

        const request = mockRequest({
            fileName: Buffer.from(fileName).toString('latin1'),
            truncated: false,
        });
        const file = await getUploadedFile(request, receivedHash);
        expect(file.name).toBe(fileName);
    });

    it("rejects when received hash does not match local hash", async () => {
        await withUploadedContent("data");
        const receivedHash = "0xf35e4bcbc1b0ce85af90914e04350cce472a2f01f00c0f7f8bc5c7ba04da2bf2";

        const request = mockRequest({
            fileName: "some-file.txt",
            truncated: false,
        });
        await expectAsync(getUploadedFile(request, receivedHash)).toBeRejectedWithError();
    });

    it("rejects when upload truncated", async () => {
        await withUploadedContent("dat");
        const receivedHash = "0x3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7";

        const request = mockRequest({
            fileName: "some-file.txt",
            truncated: true,
        });
        await expectAsync(getUploadedFile(request, receivedHash)).toBeRejectedWithError();
    });
});

const tempFilePath = path.join(os.tmpdir(), path.basename("some-file.txt"));

async function withUploadedContent(data: string): Promise<void> {
    await writeFile(tempFilePath, Buffer.from(data));
}

function mockRequest(args: { fileName: string, truncated: boolean }): Express.Request {
    const { fileName, truncated } = args;
    return {
        files: {
            "file": {
                truncated,
                tempFilePath,
                name: fileName,
            } as UploadedFile
        }
    } as Express.Request;
}
