# Mail Templates
This directory contains mail templates. The first line of each template is the **subject** of the mail, while the
subsequent lines represent the **body**.
Although there [are much customization feature](https://squirrelly.js.org/docs/), most of the time the template
contain only variables, which are replaced at runtime with their respective value:

## Available variables
### Protection Request
    requesterAddress
    addressToRecover
    isRecovery
### LOC
(TBD)
### User
    userIdentity.firstName
    userIdentity.lastName
    userIdentity.email
    userIdentity.phoneNumber

    userPostalAddress.line1
    userPostalAddress.line2
    userPostalAddress.postalCode
    userPostalAddress.city
    userPostalAddress.country
