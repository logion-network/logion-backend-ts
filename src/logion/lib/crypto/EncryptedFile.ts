import { FileHandle, open, rm } from "fs/promises";
import { scrypt, randomFill, createCipheriv, Cipher, Decipher, createDecipheriv, BinaryLike } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const WRITE_BUFFER_SIZE = 8192;
const READ_BUFFER_SIZE = 8192;

interface EncryptDecryptProps {
    clearFile?: string
    encryptedFile?: string
    keepSource?: boolean
}

export class EncryptedFileWriter {

    constructor(password: string) {
        this.password = password;
    }

    private readonly password: string;

    async open(fileName: string): Promise<void> {
        this.file = await open(fileName, 'w');

        return new Promise<void>((resolve, reject) => {
            randomFill(new Uint8Array(SALT_LENGTH), (err, salt) => {
                if (err) {
                    reject(err);
                }
                scrypt(this.password, salt, KEY_LENGTH, (err, key) => {
                    if (err) {
                        reject(err);
                    }
                    randomFill(new Uint8Array(IV_LENGTH), async (err, iv) => {
                        if (err) {
                            reject(err);
                        }

                        this.cipher = createCipheriv(ALGORITHM, key, iv);
                        await this.file!.appendFile(salt);
                        await this.file!.appendFile(iv);
                        resolve();
                    });
                });
            });
        });
    }

    private file?: FileHandle;

    private cipher?: Cipher;

    async write(data: BinaryLike) {
        const encrypted = this.cipher!.update(data);
        await this.file!.appendFile(encrypted);
    }

    async writeFromFile(clearFile: string) {
        const bufferSize = WRITE_BUFFER_SIZE;
        const buffer = new Uint8Array(bufferSize)
        const fd = await open(clearFile, 'r')
        let bytesRead = 0;
        do {
            const result = await fd.read(buffer, 0, buffer.length);
            bytesRead = result.bytesRead;
            if (result.bytesRead > 0) {
                await this.write(result.buffer.slice(0, result.bytesRead))
            }
        } while (bytesRead > 0)
        await fd.close();
    }

    async close() {
        const encrypted = this.cipher!.final();
        await this.file!.appendFile(encrypted);
        await this.file!.close();
    }

    async encrypt(props: EncryptDecryptProps): Promise<string> {
        const clearFile = props.clearFile!
        const encryptedFile = props.encryptedFile ? props.encryptedFile : `${clearFile}.enc`;
        await this.open(encryptedFile);
        await this.writeFromFile(clearFile);
        await this.close();
        if (!props.keepSource) {
            await rm(clearFile);
        }
        return encryptedFile;
    }
}

export class EncryptedFileReader {

    constructor(password: string) {
        this.password = password;
        this.buffer = new Uint8Array(READ_BUFFER_SIZE);
    }

    private readonly password: string;

    async open(fileName: string): Promise<void> {
        this.file = await open(fileName, 'r');

        const salt = new Uint8Array(SALT_LENGTH);
        await this.file.read(salt, 0, SALT_LENGTH);

        const iv = new Uint8Array(IV_LENGTH);
        await this.file.read(iv, 0, IV_LENGTH);

        return new Promise<void>((resolve, reject) => {
            scrypt(this.password, salt, KEY_LENGTH, (err, key) => {
                if (err) {
                    reject(err);
                }

                this.decipher = createDecipheriv(ALGORITHM, key, iv);
                resolve();
            });
        });
    }

    private file?: FileHandle;

    private decipher?: Decipher;

    private readonly buffer: Uint8Array;

    async read(): Promise<Buffer> {
        const encrypted = await this.file!.read(this.buffer, 0, this.buffer.length);

        if(encrypted!.bytesRead === 0) {
            return Buffer.from([]);
        } else if(encrypted!.bytesRead < this.buffer.length) {
            return Buffer.concat([this.decipher!.update(encrypted!.buffer.slice(0, encrypted!.bytesRead)), this.decipher!.final()]);
        } else {
            return this.decipher!.update(encrypted!.buffer);
        }
    }

    async readAll(): Promise<Buffer> {
        let chunks: Buffer[] = [];
        let chunk = await this.read();
        while(chunk.length > 0) {
            chunks.push(chunk);
            chunk = await this.read();
        }
        return Buffer.concat(chunks);
    }

    async readToFile(clearFile: string): Promise<void> {
        const fd = await open(clearFile, 'w')
        let chunk = await this.read();
        while(chunk.length > 0) {
            await fd.appendFile(chunk)
            chunk = await this.read();
        }
        await fd.close();
    }

    async close() {
        await this.file!.close();
    }

    async decrypt(props: EncryptDecryptProps): Promise<string> {
        const encryptedFile = props.encryptedFile!
        const clearFile = props.clearFile ? props.clearFile : `${encryptedFile}.clear`
        await this.open(encryptedFile);
        await this.readToFile(clearFile);
        await this.close()
        if (!props.keepSource) {
            await rm(encryptedFile)
        }
        return clearFile;
    }
}
