// This file should be converted back to TS as soon as a solution is found for https://github.com/logion-network/logion-internal/issues/323

import expressOasGenerator, { SPEC_OUTPUT_FILE_BEHAVIOR } from "express-oas-generator";
import { predefinedSpec, setupApp } from "../../src/logion/app.support";
import express from "express";

describe('app', () => {

    it("succeeds to do init sequence", () => {
        const app = express()
        expressOasGenerator.handleResponses(app, {
            predefinedSpec,
            specOutputFileBehavior: SPEC_OUTPUT_FILE_BEHAVIOR.RECREATE,
            swaggerDocumentOptions: {},
            alwaysServeDocs: true,
        });
        setupApp(app);
        expressOasGenerator.handleRequests()
    })
})
