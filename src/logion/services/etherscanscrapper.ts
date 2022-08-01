export class EtherscanScrapper {

    constructor(pageContent: string) {
        this.pageContent = pageContent;
    }

    private pageContent: string;

    tokenHolderInventoryPageContainsHolder(address: string): boolean {
        // Example: 0xa6db31d1aee06a3ad7e4e56de3775e80d2f5ea84
        const regex = new RegExp(`${address}`);
        return regex.test(this.pageContent);
    }
}
