import { recoverAddress } from "@ethersproject/transactions";

describe("Ethereum Wallet", () => {

    const publicAddress = "0x6ef154673a6379b2CDEDeD6aF1c0d705c3c8272a";

    it("verifies frontend signature", async () => {
        const digest = "0x420be13b05fbf2afde5d32fee30cd6ed66fe307aa831b14067ce7138bbf21451"; // displayed as "Message" in MetaMask
        const signature = "0x38fe0c82e7f0fbdcb4c66467fb65360af6ed6384f375968913befe4d2663769f5e8a82982431ef4e0e51186e9a569f2fa485f534b90ba791676ac4f9083456e51c";
        const actualAddress = recoverAddress(digest, signature);
        expect(actualAddress).toEqual(publicAddress);
    })

    it("verifies another frontend signature", async () => {
        const digest = "0x0b41be85f21f4e7a3e1cca71435f0022b706347cb20cefe133f52b887ba4c2e0"; // displayed as "Message" in MetaMask
        const signature = "0x15652e9d5ced9f3a44ba9159d28d4ee93a43b7b49a20af1c7944ac5dd1cf4af570cd73d84edd99d319a6e9197870934448b6630263567bd94e7e13b6651da8481c";
        const actualAddress = recoverAddress(digest, signature);
        expect(actualAddress).toEqual(publicAddress);
    })
})
