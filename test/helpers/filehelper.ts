import { readFile } from "fs/promises";

export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await readFile(filePath);
        return true;
    } catch {
        return false;
    }
}

