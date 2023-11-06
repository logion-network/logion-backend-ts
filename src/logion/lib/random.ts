const ALPHANUMERICS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function randomAlphanumericString(length: number): string {
    let str = '';
    for (let i = 0; i < length; i++) {
        str += ALPHANUMERICS.charAt(Math.floor(Math.random() * ALPHANUMERICS.length));
    }
    return str;
}
