# Mail Templates
This directory contains mail templates. The first line of each template is the **subject** of the mail, while the
subsequent lines represent the **body**.
Although there [are many customization features](https://squirrelly.js.org/docs/), most of the time the template
contain only variables, which are replaced at runtime with their respective value:

## Available variables

All possible variables are available (for copy/paste) in this template: [all-documented-vars.txt](all-documented-vars.txt)

### Legal Officer
    legalOfficer.address
    legalOfficer.additionalDetails
    legalOfficer.node

    legalOfficer.userIdentity.firstName
    legalOfficer.userIdentity.lastName
    legalOfficer.userIdentity.email
    legalOfficer.userIdentity.phoneNumber

    legalOfficer.postalAddress.company
    legalOfficer.postalAddress.line1
    legalOfficer.postalAddress.line2
    legalOfficer.postalAddress.postalCode
    legalOfficer.postalAddress.city
    legalOfficer.postalAddress.country

In the context of a protection (or recovery), all the variables defined above may also be prefixed with
`otherLegalOfficer` instead of `legalOfficer`. 

### Protection and Recovery Request
    protection.requesterAddress
    protection.otherLegalOfficerAddress
    protection.addressToRecover
    protection.createdOn
    protection.isRecovery

    protection.decisionOn
    protection.rejectReason
    protection.locId

### LOC
(TBD)

### Wallet User
#### Identity
    walletUser.firstName
    walletUser.lastName
    walletUser.email
    walletUser.phoneNumber

#### Postal Address
The postal address is not always available, for instance for LOC requested by non-protected wallet users.

    walletUserPostalAddress.line1
    walletUserPostalAddress.line2
    walletUserPostalAddress.postalCode
    walletUserPostalAddress.city
    walletUserPostalAddress.country
