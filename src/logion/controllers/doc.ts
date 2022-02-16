import { OpenAPIV3 } from 'express-oas-generator';
import fs from "fs";
import openapiTS from "openapi-typescript";

export function setOpenApi3(spec: OpenAPIV3.Document) {
    spec.openapi = "3.0.0";
    const anySpec = spec as any;
    if("swagger" in anySpec) {
        delete anySpec.swagger;
    }
}

export function addTag(spec: OpenAPIV3.Document, tag: OpenAPIV3.TagObject) {
    if(spec.tags === undefined) {
        spec.tags = [];
    }
    spec.tags.push(tag);
}

export function setControllerTag(spec: OpenAPIV3.Document, route: RegExp, tagName: string) {
    Object.keys(spec.paths).forEach(path => {
        if(route.test(path)) {
            const pathObject = spec.paths[path];
            _setOperationTag(pathObject.delete, tagName);
            _setOperationTag(pathObject.get, tagName);
            _setOperationTag(pathObject.head, tagName);
            _setOperationTag(pathObject.options, tagName);
            _setOperationTag(pathObject.patch, tagName);
            _setOperationTag(pathObject.post, tagName);
            _setOperationTag(pathObject.put, tagName);
        }
    });
}

function _setOperationTag(operation: OpenAPIV3.OperationObject | undefined, tagName: string) {
    if(operation !== undefined) {
        if(operation.tags === undefined) {
            operation.tags = [];
        }
        operation.tags.push(tagName);
    }
}

export async function loadSchemasIntoSpec(spec: OpenAPIV3.Document, path: string) {
    const document = await loadOpenApiDocument(path);
    if(document.components !== undefined && document.components.schemas !== undefined) {
        Object.keys(document.components.schemas).forEach(schemaName =>
            addSchema(spec, schemaName, document.components!.schemas![schemaName]!));
    }
}

export function addSchema(spec: OpenAPIV3.Document, name: string, schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject) {
    if(!spec.components) {
        spec.components = {};
        if(!spec.components.schemas) {
            spec.components.schemas = {};
        }
    }
    spec.components.schemas![name] = schema;
}

export async function loadOpenApiDocument(path: string): Promise<OpenAPIV3.Document> {
    const docString = await fs.promises.readFile(path, "utf8") // must be OpenAPI JSON
    const docJson = JSON.parse(docString);
    await openapiTS(docJson); // check validity
    return docJson as OpenAPIV3.Document;
}

export function getRequestBody(params: {description: string, view: string}): OpenAPIV3.RequestBodyObject {
    return {
        description: params.description,
        content: getBodyContent(params.view),
        required: true
    };
}

export function getBodyContent(view: string): { [media: string]: OpenAPIV3.MediaTypeObject } {
    return {
        "application/json": {
            schema: {
                $ref: "#/components/schemas/" + view,
            }
        }
    };
}

export function getDefaultResponses(view?: string): OpenAPIV3.ResponsesObject {
    return {
        "200": {
            description: "OK",
            content: view !== undefined ? getBodyContent(view) : undefined,
        },
        "401": {
            description: "Unauthorized"
        },
        "403": {
            description: "Forbidden"
        }
    };
}

export function getPublicResponses(view?: string): OpenAPIV3.ResponsesObject {
    return {
        "200": {
            description: "OK",
            content: view !== undefined ? getBodyContent(view) : undefined,
        },
        "400": {
            description: "Bad Request"
        }
    };
}

export function getDefaultResponsesNoContent(): OpenAPIV3.ResponsesObject {
    return {
        "204": {
            description: "No Content"
        },
        "401": {
            description: "Unauthorized"
        },
        "403": {
            description: "Forbidden"
        }
    };
}

export function addPathParameter(operationObject: OpenAPIV3.OperationObject, parameterName: string, description: string) {
    if(operationObject.parameters !== undefined) {
        operationObject.parameters = [];
    }
    operationObject.parameters!.push({
        name: parameterName,
        in: "path",
        description,
        required: true,
        schema: {type: "string"}
    });
}

export function getDefaultResponsesWithAnyBody(): OpenAPIV3.ResponsesObject {
    return {
        "200": {
            description: "OK"
        },
        "401": {
            description: "Unauthorized"
        },
        "403": {
            description: "Forbidden"
        }
    };
}
