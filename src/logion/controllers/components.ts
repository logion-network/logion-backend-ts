/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */


export type paths = Record<string, never>;

export type webhooks = Record<string, never>;

export interface components {
  schemas: {
    Submittable: {
      /** @description The address of the submitter */
      submitter?: components["schemas"]["SupportedAccountId"];
      fees?: components["schemas"]["FeesView"];
    };
    /**
     * ItemLifecycleView 
     * @description All item's lifecycle attributes
     */
    ItemLifecycleView: {
      /**
       * Format: date-time 
       * @description The date-time of addition (chain time)
       */
      addedOn?: string;
      /** @description The item's status */
      status?: components["schemas"]["ItemStatus"];
      /** @description If status is 'REVIEW_REJECTED', the reason of the rejection */
      rejectReason?: string;
      /**
       * Format: date-time 
       * @description The date-time of review
       */
      reviewedOn?: string;
      /**
       * Format: date-time 
       * @description The date-time of acknowledge (chain time)
       */
      acknowledgedByOwnerOn?: string;
      /**
       * Format: date-time 
       * @description The date-time of acknowledge by verified issuer (chain time)
       */
      acknowledgedByVerifiedIssuerOn?: string;
    };
    /**
     * AcceptProtectionRequestView 
     * @description Parameters for Protection Request's acceptance
     */
    AcceptProtectionRequestView: {
      /** @description ID of the Identity LOC to associate with the protection request */
      locId?: string;
    };
    ItemDeliveriesResponse: {
      [key: string]: (components["schemas"]["CheckLatestItemDeliveryResponse"])[] | undefined;
    };
    CollectionDeliveriesResponse: {
      [key: string]: (components["schemas"]["CheckCollectionDeliveryResponse"])[] | undefined;
    };
    CollectionFileDeliveriesResponse: {
      deliveries?: (components["schemas"]["CheckCollectionDeliveryResponse"])[];
    };
    CheckLatestDeliveryResponse: {
      /** @description The hash of the latest delivered copy */
      copyHash?: string;
      /**
       * Format: date-time 
       * @description The date/time at which the delivered copy was generated on
       */
      generatedOn?: string;
      /** @description The address of the owner of the linked token */
      owner?: string;
    };
    CheckCollectionDeliveryRequest: {
      /** @description The hash of a candidate delivery */
      copyHash?: string;
    };
    CheckLatestItemDeliveryResponse: {
      belongsToCurrentOwner?: boolean;
    } & components["schemas"]["CheckLatestDeliveryResponse"];
    CheckCollectionDeliveryResponse: components["schemas"]["CheckLatestDeliveryResponse"];
    CheckCollectionDeliveryWitheOriginalResponse: {
      originalFileHash?: string;
    } & components["schemas"]["CheckCollectionDeliveryResponse"];
    /** @description Backend configuration which impacts clients */
    Config: {
      /** @description Available features and their status (enabled/disabled) */
      features?: {
        iDenfy?: boolean;
        vote?: boolean;
      };
    };
    /**
     * CreateProtectionRequestView 
     * @description A Protection Request to create
     */
    CreateProtectionRequestView: {
      /** @description If this request is a recovery request, tells the address to recover */
      addressToRecover?: string;
      /** @description True if the protection request is also a recovery request */
      isRecovery?: boolean;
      /** @description The SS58 address of the legal officer the request was submitted to */
      legalOfficerAddress?: string;
      /** @description The SS58 address of the other legal officer the request was submitted to */
      otherLegalOfficerAddress?: string;
      /** @description The SS58 address of the requester */
      requesterAddress?: string;
      /** @description The identification data of the requester */
      userIdentity?: components["schemas"]["UserIdentityView"];
      /** @description The postal address of the requester */
      userPostalAddress?: components["schemas"]["PostalAddressView"];
    };
    /**
     * AcceptProtectionRequestView 
     * @description Parameters for Protection Request's acceptance
     */
    UpdateProtectionRequestView: {
      /** @description The SS58 address of the other legal officer a new request is submitted to */
      otherLegalOfficerAddress?: string;
    };
    /**
     * FetchProtectionRequestsResponseView 
     * @description The fetched Protection Requests
     */
    FetchProtectionRequestsResponseView: {
      /** @description The Protection Requests matching provided specification */
      requests?: (components["schemas"]["ProtectionRequestView"])[];
    };
    /**
     * FetchProtectionRequestsSpecificationView 
     * @description The specification for fetching Protection Requests
     */
    FetchProtectionRequestsSpecificationView: {
      /** @description The statuses of expected Protection Requests */
      statuses?: ("ACCEPTED" | "PENDING" | "REJECTED" | "ACTIVATED" | "CANCELLED" | "REJECTED_CANCELLED" | "ACCEPTED_CANCELLED")[];
      /**
       * @description The kind of protection request to be returned 
       * @enum {string}
       */
      kind?: "ANY" | "PROTECTION_ONLY" | "RECOVERY";
      /** @description The SS58 address of the requester in expected Protection Requests */
      requesterAddress?: string;
      /** @description The SS58 address of the legal officer in expected Protection Requests */
      legalOfficerAddress?: string;
    };
    /**
     * FetchTransactionsResponseView 
     * @description The fetched transactions
     */
    FetchTransactionsResponseView: {
      /** @description The transactions matching provided specification */
      transactions?: (components["schemas"]["TransactionView"])[];
    };
    /**
     * FetchTransactionsSpecificationView 
     * @description The specification for fetching Tokenization Requests
     */
    FetchTransactionsSpecificationView: {
      /** @description The SS58 address of the account from or to which the expected transaction is done */
      address?: string;
    };
    /**
     * LegalOfficerDecisionView 
     * @description Legal Officer decision
     */
    LegalOfficerDecisionView: {
      /**
       * Format: date-time 
       * @description The decision timestamp (if status is 'ACCEPTED' or 'REJECTED')
       */
      decisionOn?: string;
      /** @description If status is 'REJECTED', the reason of the rejection */
      rejectReason?: string;
      /**
       * @description The decision status 
       * @enum {string}
       */
      status?: "ACCEPTED" | "PENDING" | "REJECTED";
      /** @description ID of the Identity LOC linked to an accepted protection request. */
      locId?: string;
    };
    /**
     * PostalAddressView 
     * @description A postal address
     */
    PostalAddressView: {
      /** @description City */
      city?: string;
      /** @description Country */
      country?: string;
      /** @description First address line */
      line1?: string;
      /** @description Second address line */
      line2?: string;
      /** @description Postal code */
      postalCode?: string;
    };
    /**
     * ProtectionRequestView 
     * @description Information about the created Protection Request
     */
    ProtectionRequestView: {
      /** @description If this request is a recovery request, tells the address to recover */
      addressToRecover?: string;
      /**
       * Format: date-time 
       * @description The creation timestamp
       */
      createdOn?: string;
      decision?: components["schemas"]["LegalOfficerDecisionView"];
      /**
       * Format: uuid 
       * @description The ID of created Protection Request
       */
      id?: string;
      /** @description True if the the protection request is also a recovery request */
      isRecovery?: boolean;
      /** @description The SS58 address of the legal officer the request was submitted to */
      legalOfficerAddress?: string;
      /** @description The SS58 address of the other legal officer the request was submitted to */
      otherLegalOfficerAddress?: string;
      /** @description The SS58 address of the requester */
      requesterAddress?: string;
      /**
       * @description The status 
       * @enum {string}
       */
      status?: "ACCEPTED" | "PENDING" | "REJECTED" | "ACTIVATED" | "CANCELLED" | "REJECTED_CANCELLED" | "ACCEPTED_CANCELLED";
      /** @description The identification data of the requester */
      userIdentity?: components["schemas"]["UserIdentityView"];
      /** @description The postal address of the requester */
      userPostalAddress?: components["schemas"]["PostalAddressView"];
    };
    /**
     * RecoveryInfoView 
     * @description The new (recovery) and old (to recover) account data
     */
    RecoveryInfoView: {
      /** @description The address to recover */
      addressToRecover?: string;
      accountToRecover?: components["schemas"]["ProtectionRequestView"];
      recoveryAccount?: components["schemas"]["ProtectionRequestView"];
    };
    /**
     * RejectProtectionRequestView 
     * @description The Protection Request to reject
     */
    RejectProtectionRequestView: {
      /** @description The rejection reason */
      rejectReason?: string;
    };
    /**
     * RejectTokenRequestView 
     * @description The Tokenization Request to reject
     */
    RejectTokenRequestView: {
      /** @description The rejection reason */
      rejectReason?: string;
    };
    /**
     * FeesView 
     * @description The fee breakdown for a given extrinsic
     */
    FeesView: {
      /** @description Inclusion fee */
      inclusion?: string;
      /** @description File storage fee (if applicable) */
      storage?: string;
      /** @description Legal fee (if applicable) */
      legal?: string;
      /** @description Certificate fee (if applicable) */
      certificate?: string;
      /** @description Total fee (inclusion + storage) */
      total?: string;
    };
    /**
     * TransactionView 
     * @description A transaction altering one or two account's balance
     */
    TransactionView: {
      /**
       * Format: uuid 
       * @description The ID of the transaction
       */
      id?: string;
      /**
       * Format: date-time 
       * @description The timestamp of the transaction
       */
      createdOn?: string;
      fees?: components["schemas"]["FeesView"];
      /** @description The SS58 address of the account from which the transaction is done */
      from?: string;
      /** @description The method that created the transaction. */
      method?: string;
      /** @description The pallet that created the transaction. */
      pallet?: string;
      /** @description The reserved amount of the transaction. */
      reserved?: string;
      /** @description The tip of the transaction. */
      tip?: string;
      /** @description The SS58address of the account to which the transaction is done. May be null. */
      to?: string;
      /** @description The total amount of the transaction. */
      total?: string;
      /** @description The value of the transfer, iff the transaction is a transfer. */
      transferValue?: string;
      /** @description Indicates if the transaction was successful. */
      successful?: boolean;
      error?: {
        /** @description The error section, typically equal to the pallet. */
        section?: string;
        /** @description The error name. */
        name?: string;
        /** @description Some details about the error. */
        details?: string;
      };
      /**
       * @description The transaction's type 
       * @enum {string}
       */
      type?: "EXTRINSIC" | "VAULT_OUT" | "LEGAL_FEE" | "STORAGE_FEE" | "CERTIFICATE_FEE" | "OTHER_FEES" | "VALUE_FEE" | "RESERVE";
    };
    /**
     * UserIdentityView 
     * @description Physical person identification data
     */
    UserIdentityView: {
      /** @description E-mail */
      email?: string;
      /** @description First name */
      firstName?: string;
      /** @description Last name */
      lastName?: string;
      /** @description Phone number */
      phoneNumber?: string;
    };
    /**
     * @description The request's status 
     * @enum {string}
     */
    LocRequestStatus: "OPEN" | "REVIEW_PENDING" | "REVIEW_REJECTED" | "REVIEW_ACCEPTED" | "CLOSED" | "DRAFT";
    /**
     * @description The LOC's type 
     * @enum {string}
     */
    LocType: "Identity" | "Transaction" | "Collection";
    /**
     * @description The Identity LOC's type 
     * @enum {string}
     */
    IdentityLocType: "Polkadot" | "Logion" | "Ethereum" | "Bech32";
    /**
     * @description The address type 
     * @enum {string}
     */
    AddressType: "Polkadot" | "Ethereum" | "Bech32";
    SupportedAccountId: {
      /** @description The type of the address of the requester */
      type: components["schemas"]["AddressType"];
      /** @description The address. Depending on type, either a Polkadot address (SS58 format) or Ethereum (usual '0x' prefixed hexadecimal format) */
      address: string;
    };
    /**
     * BaseLocView 
     * @description Base LOC attributes
     */
    BaseLocView: {
      /** @description The SS58 address of the legal officer that will own the LOC upon acceptance */
      ownerAddress?: string;
      /** @description A description of the LOC */
      description?: string;
      /** @description The type of the LOC to create */
      locType?: components["schemas"]["LocType"];
      /** @description The identification data of the requester */
      userIdentity?: components["schemas"]["UserIdentityView"];
      /** @description The postal address of the requester */
      userPostalAddress?: components["schemas"]["PostalAddressView"];
      /** @description If the user requesting an Identity LOC is representing a company, its legal entity name */
      company?: string;
      /** @description The LOC's template or undefined */
      template?: string;
      /** @description The value fee associated with this collection LOC */
      valueFee?: string;
      /** @description The legal fee associated with this LOC */
      legalFee?: string;
    };
    OpenLocView: {
      /** @description The metadata attached to this LOC */
      metadata?: (components["schemas"]["AddMetadataView"])[];
      /** @description The metadata attached to this LOC */
      files?: (components["schemas"]["AddFileView"])[];
      /** @description The metadata attached to this LOC */
      links?: (components["schemas"]["AddLinkView"])[];
    } & components["schemas"]["BaseLocView"];
    /**
     * CreateLocRequestView 
     * @description A LOC Request to create
     */
    CreateLocRequestView: {
      /** @description The address of the requester (this is only taken into account when created by the owner, which is needed when replacing a voided LOC) */
      requesterAddress?: components["schemas"]["SupportedAccountId"];
      /**
       * Format: uuid 
       * @description The ID of the LOC identifying the requester
       */
      requesterIdentityLoc?: string;
      /** @description LOC will be created with initial status DRAFT if true, REQUESTED otherwise (false or undefined) */
      draft?: boolean;
      /** @description The ID of the sponsorship to use */
      sponsorshipId?: string;
    } & components["schemas"]["BaseLocView"];
    /**
     * @description The request's status 
     * @enum {string}
     */
    ItemStatus: "DRAFT" | "REVIEW_PENDING" | "REVIEW_ACCEPTED" | "REVIEW_REJECTED" | "PUBLISHED" | "ACKNOWLEDGED";
    LocFileView: {
      /** @description The file's name */
      name?: string;
      /** @description The file's hash */
      hash?: string;
      /** @description The file's nature */
      nature?: string;
      /** @description true if the file can be downloaded by collection item owner. Applicable only for collection. */
      restrictedDelivery?: boolean;
      /** @description The file's size, in bytes. */
      size?: string;
      /** @description The file's content type (MIME format). */
      contentType?: string;
      /** @description Account from which storage fees were withdrawn. */
      storageFeePaidBy?: string;
    } & components["schemas"]["ItemLifecycleView"] & components["schemas"]["Submittable"];
    LocMetadataItemView: {
      /** @description The item's name */
      name?: string;
      /** @description The item's name hash */
      nameHash: string;
      /** @description The item's value */
      value?: string;
    } & components["schemas"]["ItemLifecycleView"] & components["schemas"]["Submittable"];
    LocLinkView: {
      /** @description The link's target */
      target?: string;
      /** @description The link's nature */
      nature?: string;
    } & components["schemas"]["ItemLifecycleView"] & components["schemas"]["Submittable"];
    /**
     * LocRequestView 
     * @description An existing LOC Request
     */
    LocRequestView: {
      /** @description The SS58 address of the legal officer that will own the LOC upon acceptance */
      ownerAddress?: string;
      /** @description The address of the requester */
      requesterAddress?: components["schemas"]["SupportedAccountId"];
      /**
       * Format: uuid 
       * @description The ID of the LOC identifying the requester (populated for LOGION identity only)
       */
      requesterIdentityLoc?: string;
      /** @description A description of the LOC */
      description?: string;
      /** @description The identification data of the requester */
      userIdentity?: components["schemas"]["UserIdentityView"];
      /** @description The postal address of the requester */
      userPostalAddress?: components["schemas"]["PostalAddressView"];
      /**
       * Format: date-time 
       * @description The creation timestamp
       */
      createdOn?: string;
      /**
       * Format: date-time 
       * @description The decision timestamp (if status is 'OPEN' or 'REJECTED')
       */
      decisionOn?: string;
      /**
       * Format: date-time 
       * @description The closing timestamp (if status is 'CLOSED')
       */
      closedOn?: string;
      /**
       * Format: uuid 
       * @description The ID of the LOC request, which is also the ID of the LOC
       */
      id?: string;
      status?: components["schemas"]["LocRequestStatus"];
      /** @description If status is 'REJECTED', the reason of the rejection */
      rejectReason?: string;
      /**
       * @description The seal of the given LOC 
       * @example 0x48aedf4e08e46b24970d97db566bfa6668581cc2f37791bac0c9817a4508607a
       */
      seal?: string;
      /**
       * Format: uuid 
       * @description The ID of the LOC identifying the requester (populated for both LOGION and POLKADOT identity)
       */
      identityLoc?: string;
      /** @description The files attached to this request's LOC */
      files?: (components["schemas"]["LocFileView"])[];
      /** @description The links attached to this request's LOC */
      links?: (components["schemas"]["LocLinkView"])[];
      /** @description The type of the LOC to create */
      locType?: components["schemas"]["LocType"];
      /** @description The metadata attached to this request's LOC */
      metadata?: (components["schemas"]["LocMetadataItemView"])[];
      /** @description Data about LOC voiding */
      voidInfo?: {
        /** @description Voiding reason */
        reason?: string;
        /**
         * Format: date-time 
         * @description The date-time of voiding (chain time)
         */
        voidedOn?: string;
      };
      /** @description If the user requesting an Identity LOC is representing a company, its legal entity name */
      company?: string;
      iDenfy?: {
        /**
         * @description The status of current iDenfy verification session 
         * @enum {unknown}
         */
        status?: "APPROVED" | "DENIED" | "SUSPECTED" | "EXPIRED" | "PENDING";
        /** @description The iDenfy redirect when status is PENDING */
        redirectUrl?: string;
      };
      /** @description The ID of the vote linked to the present LOC, if applicable */
      voteId?: string;
      selectedIssuers?: (components["schemas"]["VerifiedIssuerIdentity"])[];
      /** @description The LOC's template or undefined */
      template?: string;
      /** @description The ID of the sponsorship to use */
      sponsorshipId?: string;
      /** @description The value fee associated with this collection LOC */
      valueFee?: string;
      /** @description The legal fee associated with this LOC */
      legalFee?: string;
    };
    /**
     * LocPublicView 
     * @description The published attributes of an existing LOC
     */
    LocPublicView: {
      /** @description The SS58 address of the legal officer that will own the LOC upon acceptance */
      ownerAddress?: string;
      /** @description The address of the requester */
      requesterAddress?: components["schemas"]["SupportedAccountId"];
      /**
       * Format: uuid 
       * @description The ID of the LOC identifying the requester
       */
      requesterIdentityLoc?: string;
      /**
       * Format: date-time 
       * @description The creation timestamp
       */
      createdOn?: string;
      /**
       * Format: date-time 
       * @description The closing timestamp (if status is 'CLOSED')
       */
      closedOn?: string;
      /**
       * Format: uuid 
       * @description The ID of the LOC request, which is also the ID of the LOC
       */
      id?: string;
      /** @description The files attached to this request's LOC */
      files?: ({
          /** @description The file's nature */
          nature?: string;
          /** @description The file's hash */
          hash?: string;
          /**
           * Format: date-time 
           * @description The date-time of addition (chain time)
           */
          addedOn?: string;
          /** @description The address of the submitter */
          submitter?: components["schemas"]["SupportedAccountId"];
          /** @description The file's content type (MIME) */
          contentType?: string;
        })[];
      /** @description The links attached to this request's LOC */
      links?: ({
          /** @description The link's target */
          target?: string;
          /**
           * Format: date-time 
           * @description The date-time of addition (chain time)
           */
          addedOn?: string;
          /** @description The link's nature */
          nature?: string;
          /** @description The address of the submitter */
          submitter?: components["schemas"]["SupportedAccountId"];
        })[];
      /** @description The type of the LOC to create */
      locType?: components["schemas"]["LocType"];
      /** @description The metadata attached to this request's LOC */
      metadata?: ({
          /** @description The item's name */
          name?: string;
          /** @description The item's name hash */
          nameHash?: string;
          /** @description The item's value */
          value?: string;
          /**
           * Format: date-time 
           * @description The date-time of addition (chain time)
           */
          addedOn?: string;
          /** @description The address of the submitter */
          submitter?: components["schemas"]["SupportedAccountId"];
        })[];
      /** @description Data about LOC voiding */
      voidInfo?: {
        /**
         * Format: date-time 
         * @description The date-time of voiding (chain time)
         */
        voidedOn?: string;
      };
      /** @description The LOC's template or undefined */
      template?: string;
    };
    /**
     * FetchLocRequestsSpecificationView 
     * @description The specification for fetching LOC Requests
     */
    FetchLocRequestsSpecificationView: {
      /** @description The SS58 address of the owner in expected LOC Requests */
      ownerAddress?: string;
      /** @description The SS58 address of the requester in expected LOC Requests */
      requesterAddress?: string;
      /** @description The statuses of expected LOC Requests */
      statuses?: (components["schemas"]["LocRequestStatus"])[];
      /** @description The type of the LOC to fetch */
      locTypes?: (components["schemas"]["LocType"])[];
      identityLocType?: components["schemas"]["IdentityLocType"];
      /**
       * Format: uuid 
       * @description The ID of sponsorship
       */
      sponsorshipId?: string;
    };
    /**
     * FetchLocRequestsResponseView 
     * @description The fetched LOC Requests
     */
    FetchLocRequestsResponseView: {
      /** @description The LOC Requests matching provided specification */
      requests?: (components["schemas"]["LocRequestView"])[];
    };
    /**
     * RejectLocRequestView 
     * @description The info to reject a LOC request
     */
    RejectLocRequestView: {
      /** @description The rejection reason */
      rejectReason?: string;
    };
    AddFileView: {
      /** @description Hash of uploaded file */
      hash?: string;
      /** @description The file's nature */
      nature?: string;
      /** @description true if the file can be downloaded by collection item owner. Applicable only for collection. */
      restrictedDelivery?: boolean;
    };
    AddLinkView: {
      /** @description The link's target */
      target?: string;
      /** @description The file's nature */
      nature?: string;
    };
    AddMetadataView: {
      /** @description The item's name */
      name?: string;
      /** @description The item's value */
      value?: string;
    };
    /**
     * VoidLocView 
     * @description The parameters of LOC voiding
     */
    VoidLocView: {
      /** @description The voiding reason */
      reason?: string;
    };
    CreateCollectionItemView: {
      /**
       * @description The id of the collection item 
       * @example 0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705
       */
      itemId?: string;
      /** @description The description of the item */
      description?: string;
      /** @description The files */
      files?: (components["schemas"]["CollectionItemFileView"])[];
      /** @description The terms and conditions */
      termsAndConditions?: (components["schemas"]["TermsAndConditionsElementView"])[];
      token?: components["schemas"]["CollectionItemTokenView"];
    };
    CollectionItemFileView: {
      hash?: components["schemas"]["HashView"];
      /** @description The file name */
      name?: string;
      /** @description The content type */
      contentType?: string;
      /** @description True if the file was already uploaded, false otherwise */
      uploaded?: boolean;
    };
    /**
     * @description A hash 
     * @example 0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705
     */
    HashView: string;
    TermsAndConditionsElementView: {
      /** @description The type of terms and conditions */
      type?: string;
      /** @description The details associated with given terms and conditions */
      details?: string;
    };
    /** @description The item's token */
    CollectionItemTokenView: {
      /** @description Token type */
      type?: string;
      /** @description Token ID */
      id?: string;
    };
    CollectionItemView: {
      /**
       * @description The id of the collection loc 
       * @example 5e4ef4bb-8657-444c-9880-d89e9403fc85
       */
      collectionLocId?: string;
      /**
       * @description The id of the collection item 
       * @example 0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705
       */
      itemId?: string;
      /** @description The description of the item */
      description?: string;
      /**
       * Format: date-time 
       * @description The creation timestamp
       */
      addedOn?: string;
      /** @description The files present in DB */
      files?: (components["schemas"]["CollectionItemFileView"])[];
      /** @description The terms and conditions */
      termsAndConditions?: (components["schemas"]["TermsAndConditionsElementView"])[];
      token?: components["schemas"]["CollectionItemTokenView"];
    };
    CollectionItemsView: {
      /** @description The items of a given collection */
      items?: (components["schemas"]["CollectionItemView"])[];
    };
    CloseView: {
      /**
       * @description The seal of the given LOC 
       * @example 0x48aedf4e08e46b24970d97db566bfa6668581cc2f37791bac0c9817a4508607a
       */
      seal?: string;
    };
    /**
     * CreateVaultTransferRequestView 
     * @description A Protection Request to create
     */
    CreateVaultTransferRequestView: {
      /** @description The origin SS58 address of the transfer. In case of a regular vault-out transfer, this equals to requesterAddress. In case of a vault recovery, this equals to the recovered account */
      origin?: string;
      /** @description The destination SS58 address of the transfer */
      destination?: string;
      /** @description The SS58 address of the legal officer the request was submitted to */
      legalOfficerAddress?: string;
      /** @description The amount to transfer */
      amount?: string;
      /** @description The block number at which the call was submitted */
      block?: string;
      /** @description The index of the call's transaction in the block */
      index?: number;
    };
    /**
     * FetchVaultTransferRequestsResponseView 
     * @description The fetched Protection Requests
     */
    FetchVaultTransferRequestsResponseView: {
      /** @description The Protection Requests matching provided specification */
      requests?: (components["schemas"]["VaultTransferRequestView"])[];
    };
    /**
     * VaultTransferRequestStatusView 
     * @description The status of a Vault Transfer Request 
     * @enum {unknown}
     */
    VaultTransferRequestStatusView: "ACCEPTED" | "PENDING" | "REJECTED" | "CANCELLED" | "REJECTED_CANCELLED";
    /**
     * FetchVaultTransferRequestsSpecificationView 
     * @description The specification for fetching Vault Transfer Requests
     */
    FetchVaultTransferRequestsSpecificationView: {
      /** @description The statuses of expected Vault Transfer Requests */
      statuses?: (components["schemas"]["VaultTransferRequestStatusView"])[];
      /** @description The SS58 address of the requester in expected Vault Transfer Requests */
      requesterAddress?: string;
      /** @description The SS58 address of the legal officer in expected Vault Transfer Requests */
      legalOfficerAddress?: string;
    };
    /**
     * VaultTransferRequestDecisionDecisionView 
     * @description Legal Officer decision
     */
    VaultTransferRequestDecisionDecisionView: {
      /**
       * Format: date-time 
       * @description The decision timestamp (if status is 'ACCEPTED' or 'REJECTED')
       */
      decisionOn?: string;
      /** @description If decision is reject, the reason of the rejection */
      rejectReason?: string;
    };
    /**
     * VaultTransferRequestView 
     * @description Information about the created Protection Request
     */
    VaultTransferRequestView: {
      /**
       * Format: date-time 
       * @description The creation timestamp
       */
      createdOn?: string;
      decision?: components["schemas"]["VaultTransferRequestDecisionDecisionView"];
      /**
       * Format: uuid 
       * @description The ID of created Protection Request
       */
      id?: string;
      /** @description The origin SS58 address of the transfer. In case of a regular vault-out transfer, this equals to requesterAddress. In case of a vault recovery, this equals to the recovered account */
      origin?: string;
      /** @description The destination SS58 address of the transfer */
      destination?: string;
      /** @description The amount to transfer */
      amount?: string;
      /** @description The block number at which the call was submitted */
      block?: string;
      /** @description The index of the call's transaction in the block */
      index?: number;
      status?: components["schemas"]["VaultTransferRequestStatusView"];
      requesterIdentity?: components["schemas"]["UserIdentityView"];
      requesterPostalAddress?: components["schemas"]["PostalAddressView"];
    };
    /**
     * RejectVaultTransferRequestView 
     * @description The Protection Request to reject
     */
    RejectVaultTransferRequestView: {
      /** @description The rejection reason */
      rejectReason?: string;
    };
    /**
     * CreateSofRequestView 
     * @description A Statement of Facts Request to create
     */
    CreateSofRequestView: {
      /**
       * Format: uuid 
       * @description The ID of the LOC 
       * @example 5e4ef4bb-8657-444c-9880-d89e9403fc85
       */
      locId?: string;
      /**
       * @description The ID of the collection item, if the LOC is a collection 
       * @example 0xecdc3920d5cb4d6721f65c6c36f35996faf34eccf8f7948d69004483fddf19e6
       */
      itemId?: string;
      /** @description The legal fee associated with this LOC */
      legalFee?: string;
    };
    FileUploadData: {
      hash?: string;
    };
    /** @description Provides the URLs to resume the identification at Logion site after completion of the identity verification process at iDenfy */
    IdenfyVerificationCreationView: {
      /** @description A url where a client will be redirected after a successful verification */
      successUrl: string;
      /** @description A url where a client will be redirected after a failed verification */
      errorUrl: string;
      /** @description A url where a client will be redirected after a not analyzed verification. E.g. user immediately cancels process */
      unverifiedUrl: string;
    };
    /** @description Provides the URL to redirect to in order to start an identity verification process at iDenfy */
    IdenfyVerificationRedirectView: {
      /** @description The URL to redirect to */
      url?: string;
    };
    /**
     * FetchVotesResponseView 
     * @description The fetched votes
     */
    FetchVotesResponseView: {
      votes?: (components["schemas"]["VoteView"])[];
    };
    /** @description Provides the info about a vote */
    VoteView: {
      /** @description The ID of the vote */
      voteId?: string;
      /**
       * Format: uuid 
       * @description The ID of the LOC the vote is based on
       */
      locId?: string;
      /**
       * Format: date-time 
       * @description The creation timestamp
       */
      createdOn?: string;
      /**
       * @description Tells if the vote was closed. 
       * @enum {string}
       */
      status?: "PENDING" | "APPROVED" | "REJECTED";
      /** @description Each represents the vote of a voter, additional ballots are expected as long as the vote is not closed. */
      ballots?: {
        [key: string]: ("Yes" | "No") | undefined;
      };
    };
    UpdateCollectionFile: {
      /** @description true if the file can be downloaded by collection item owner. Applicable only for collection. */
      restrictedDelivery?: boolean;
    };
    VerifiedIssuersIdentityResponse: {
      issuers?: (components["schemas"]["VerifiedIssuerIdentity"])[];
    };
    /** @description The identity data of a verified issuer. */
    VerifiedIssuerIdentity: {
      /** @description The SS58 address of the issuer */
      address?: string;
      /** @description The ID of the issuer's Identity LOC */
      identityLocId?: string;
      identity?: components["schemas"]["UserIdentityView"];
      /** @description Tells if the issuer was selected for a given LOC (undefined if not relevant) */
      selected?: boolean;
    };
    CreateTokensRecordView: {
      /**
       * @description The id of the tokens record 
       * @example 0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705
       */
      recordId?: string;
      /** @description The description of the item */
      description?: string;
      /** @description The files */
      files?: (components["schemas"]["TokensRecordFileView"])[];
    };
    TokensRecordFileView: {
      hash?: components["schemas"]["HashView"];
      /** @description The file name */
      name?: string;
      /** @description The content type */
      contentType?: string;
      /** @description True if the file was already uploaded, false otherwise */
      uploaded?: boolean;
    };
    TokensRecordView: {
      /**
       * @description The id of the collection loc 
       * @example 5e4ef4bb-8657-444c-9880-d89e9403fc85
       */
      collectionLocId?: string;
      /**
       * @description The id of the collection item 
       * @example 0x818f1c9cd44ed4ca11f2ede8e865c02a82f9f8a158d8d17368a6818346899705
       */
      recordId?: string;
      /** @description The description of the item */
      description?: string;
      /**
       * Format: date-time 
       * @description The creation timestamp
       */
      addedOn?: string;
      /** @description The files present in DB */
      files?: (components["schemas"]["TokensRecordFileView"])[];
    };
    TokensRecordsView: {
      /** @description The items of a given collection */
      records?: (components["schemas"]["TokensRecordView"])[];
    };
    ReviewItemView: {
      /**
       * @description The review's outcome 
       * @enum {string}
       */
      decision: "ACCEPT" | "REJECT";
      /** @description The rejection reason */
      rejectReason?: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}

export type external = Record<string, never>;

export type operations = Record<string, never>;
