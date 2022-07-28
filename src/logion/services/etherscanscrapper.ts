export class EtherscanScrapper {

    constructor(pageContent: string) {
        this.pageContent = pageContent;
    }

    private pageContent: string;

    getLastPage(): number {
        // Example: Page <strong class="font-weight-medium">1</strong> of <strong class="font-weight-medium">1
        const matches = /page <[a-z="-\s]+>[0-9]+<\/[a-z\s]+> of <[a-z="-\s]+>([0-9]+)/i.exec(this.pageContent);
        return matches ? Number(matches[1]) : 1;
    }

    isEmptyTokenHolderInventoryPage(): boolean {
        // Example: There are no matching entries
        return /no matching entries/i.test(this.pageContent);
    }

    tokenHolderInventoryPageContainsToken(contractHash: string, tokenId: string): boolean {
        // Example: /token/0x765df6da33c1ec1f83be42db171d7ee334a46df5?a=4391
        const regex = new RegExp(`/token/${contractHash}\\?a=${tokenId}`);
        return regex.test(this.pageContent);
    }
}
