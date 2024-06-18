import { PostalAddress } from "./postaladdress.js";
import { UserIdentity } from "./useridentity.js";
import { ValidAccountId } from "@logion/node-api";
import { appDataSource } from "@logion/rest-api-core";
import { Entity, Column, PrimaryColumn, Repository } from "typeorm";
import { injectable } from "inversify";
import { DB_SS58_PREFIX } from "./supportedaccountid.model.js";

interface LegalOfficerPostalAddress extends PostalAddress {
    readonly company: string
}

export interface LegalOfficerSettingId {
    id: string,
    legalOfficer: ValidAccountId,
}

@Entity("legal_officer")
export class LegalOfficerAggregateRoot {

    @PrimaryColumn()
    address?: string;

    @Column({ length: 255, name: "first_name" })
    firstName?: string;

    @Column({ length: 255, name: "last_name" })
    lastName?: string;

    @Column({ length: 255 })
    email?: string;

    @Column({ length: 255, name: "phone_number" })
    phoneNumber?: string;

    @Column({ length: 255, nullable: true })
    company?: string;

    @Column({ length: 255 })
    line1?: string;

    @Column({ length: 255, nullable: true })
    line2?: string;

    @Column({ length: 255, name: "postal_code" })
    postalCode?: string;

    @Column({ length: 255 })
    city?: string;

    @Column({ length: 255 })
    country?: string;

    @Column({ length: 255, name: "additional_details", nullable: true })
    additionalDetails?: string;

    getDescription(): LegalOfficerDescription {
        return {
            account: ValidAccountId.polkadot(this.address!),
            userIdentity: {
                firstName: this.firstName || "",
                lastName: this.lastName || "",
                email: this.email || "",
                phoneNumber: this.phoneNumber || "",
            },
            postalAddress: {
                company: this.company || "",
                line1: this.line1 || "",
                line2: this.line2 || "",
                postalCode: this.postalCode || "",
                city: this.city || "",
                country: this.country || "",
            },
            additionalDetails: this.additionalDetails || "",
        }
    }
}

export interface LegalOfficerDescription {
    readonly account: ValidAccountId;
    readonly userIdentity: UserIdentity;
    readonly postalAddress: LegalOfficerPostalAddress;
    readonly additionalDetails: string;
}

@injectable()
export class LegalOfficerFactory {

    newLegalOfficer(description: LegalOfficerDescription): LegalOfficerAggregateRoot {
        const legalOfficer = new LegalOfficerAggregateRoot();
        legalOfficer.address = description.account.getAddress(DB_SS58_PREFIX);

        const userIdentity = description.userIdentity;
        legalOfficer.firstName = userIdentity.firstName;
        legalOfficer.lastName = userIdentity.lastName;
        legalOfficer.email = userIdentity.email;
        legalOfficer.phoneNumber = userIdentity.phoneNumber;

        const postalAddress = description.postalAddress
        legalOfficer.company = postalAddress.company;
        legalOfficer.line1 = postalAddress.line1;
        legalOfficer.line2 = postalAddress.line2;
        legalOfficer.postalCode = postalAddress.postalCode;
        legalOfficer.city = postalAddress.city;
        legalOfficer.country = postalAddress.country;

        legalOfficer.additionalDetails = description.additionalDetails;

        return legalOfficer;
    }
}

@injectable()
export class LegalOfficerRepository {

    constructor() {
        this.repository = appDataSource.getRepository(LegalOfficerAggregateRoot);
    }

    readonly repository: Repository<LegalOfficerAggregateRoot>

    public findByAccount(address: ValidAccountId): Promise<LegalOfficerAggregateRoot | null> {
        return this.repository.findOneBy({ address: address.getAddress(DB_SS58_PREFIX) });
    }

    public findAll(): Promise<LegalOfficerAggregateRoot []> {
        return this.repository.find();
    }

    public async save(root: LegalOfficerAggregateRoot): Promise<void> {
        await this.repository.save(root);
    }

}


