# Mail Templates
This directory contains mail templates. The first line of each template is the **subject** of the mail, while the
subsequent lines represent the **body**.
Although there [are many customization features](https://pugjs.org/), most of the time the template
contain only variables, which are replaced at runtime with their respective value:

## Available variables

All possible variables are available (for copy/paste) in this template: [all-documented-vars.pug](all-documented-vars.pug)

### Legal Officer
    legalOfficer.account.address
    legalOfficer.additionalDetails

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

In the context of an account recovery, all the variables defined above may also be prefixed with
`otherLegalOfficer` instead of `legalOfficer`. 

### Recovery Request
    recovery.requesterAddress
    recovery.otherLegalOfficerAddress
    recovery.addressToRecover
    recovery.createdOn
    recovery.isRecovery

    recovery.decision.decisionOn
    recovery.decision.rejectReason
    recovery.decision.locId

### LOC
    loc.id
    loc.requesterAddress
    loc.requesterIdentityLoc
    loc.ownerAddress
    loc.description
    loc.createdOn
    loc.locType

    loc.decision.decisionOn
    loc.decision.rejectReason

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

### Vault transfer
    vaultTransfer.id
    vaultTransfer.requesterAddress
    vaultTransfer.createdOn
    vaultTransfer.destination
    vaultTransfer.amount
    vaultTransfer.call
    vaultTransfer.timepoint.blockNumber
    vaultTransfer.timepoint.extrinsicIndex

    vaultTransfer.decision.decisionOn
    vaultTransfer.decision.rejectReason
