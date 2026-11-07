/**
 * Reads one thing from the API's description of itself: the argument names
 * of a database function. Pure; it never fetches anything.
 *
 * It is not an OpenAPI engine. It understands the request body of
 * `POST /rpc/<name>` in three layouts and nothing else:
 *
 *   1. arguments written inline: `parameters[].schema.properties`. This is
 *      the layout in PostgREST's own v13.0.5 test suite
 *      (test/spec/Feature/OpenApi/OpenApiSpec.hs), and the one the harness
 *      first supported;
 *   2. the same, with the parameter or its schema behind a local reference
 *      (`#/parameters/...`, `#/definitions/...`);
 *   3. an OpenAPI 3 `requestBody`, with its schema inline or behind a local
 *      reference (`#/components/...`).
 *
 * Layouts 2 and 3 are handled defensively. Nobody has observed the
 * disposable project serving them, and nothing here says which it serves.
 *
 * Three different answers, kept apart on purpose:
 *
 *   absent        the description has no such function;
 *   arguments     a body schema was understood, and these are its names
 *                 (which may turn out to be the wrong ones);
 *   unreadable    the description is in a form this does not understand.
 *                 That says NOTHING about the function's arguments.
 *
 * A reference is only ever looked up inside the same document. One that
 * points anywhere else is refused, never followed.
 */

export type FunctionSignature =
    | { kind: "absent" }
    | { kind: "arguments"; names: string[] }
    | { kind: "unreadable"; code: UnreadableCode };

export type UnreadableCode =
    | "not-a-description"
    | "path-malformed"
    | "no-post-operation"
    | "no-request-body"
    | "body-schema-missing"
    | "body-schema-has-no-properties"
    | "reference-malformed"
    | "reference-external"
    | "reference-not-allowed"
    | "reference-unresolved"
    | "reference-circular"
    | "reference-too-deep";

/** How many references in a row are followed before giving up. */
export const MAX_REFERENCE_DEPTH = 8;

/** The only places a reference may point. */
const REFERENCE_ROOTS = ["#/parameters/", "#/definitions/", "#/components/schemas/", "#/components/requestBodies/", "#/components/parameters/"];

type Node = Record<string, unknown>;
const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null && !Array.isArray(value);
const own = (node: Node, key: string): unknown => (Object.prototype.hasOwnProperty.call(node, key) ? node[key] : undefined);

class Unreadable extends Error {
    constructor(readonly code: UnreadableCode) {
        super(code);
    }
}

/** One step of a JSON Pointer inside a URI fragment: percent-decoded, then `~1` and `~0`. */
function pointerSegments(reference: string): string[] {
    return reference.slice(2).split("/").map((segment) => {
        let decoded: string;
        try {
            decoded = decodeURIComponent(segment);
        } catch {
            throw new Unreadable("reference-malformed");
        }
        return decoded.replace(/~1/g, "/").replace(/~0/g, "~");
    });
}

function lookUp(root: Node, reference: unknown): unknown {
    if (typeof reference !== "string" || reference === "") throw new Unreadable("reference-malformed");
    if (!reference.startsWith("#")) throw new Unreadable("reference-external");
    if (!reference.startsWith("#/")) throw new Unreadable("reference-malformed");
    if (!REFERENCE_ROOTS.some((allowed) => reference.startsWith(allowed) && reference.length > allowed.length)) throw new Unreadable("reference-not-allowed");

    let node: unknown = root;
    for (const segment of pointerSegments(reference)) {
        if (!isNode(node)) throw new Unreadable("reference-unresolved");
        node = own(node, segment);
        if (node === undefined) throw new Unreadable("reference-unresolved");
    }
    return node;
}

/** Follows `$ref` until it reaches something that is not a reference. Bounded, local, and never circular. */
function resolve(root: Node, value: unknown): unknown {
    const seen = new Set<string>();
    let node = value;
    while (isNode(node) && own(node, "$ref") !== undefined) {
        const reference = own(node, "$ref");
        if (typeof reference === "string" && seen.has(reference)) throw new Unreadable("reference-circular");
        if (seen.size >= MAX_REFERENCE_DEPTH) throw new Unreadable("reference-too-deep");
        if (typeof reference === "string") seen.add(reference);
        node = lookUp(root, reference);
    }
    return node;
}

/** The schema of the request body, wherever this layout keeps it. Not yet resolved. */
function bodySchema(root: Node, post: Node): unknown {
    // OpenAPI 3: requestBody.content[media type].schema
    const requestBody = own(post, "requestBody");
    if (requestBody !== undefined) {
        const body = resolve(root, requestBody);
        const content = isNode(body) ? own(body, "content") : undefined;
        if (!isNode(content)) throw new Unreadable("body-schema-missing");
        const media = own(content, "application/json") ?? Object.values(content).find((entry) => isNode(entry) && own(entry, "schema") !== undefined);
        const schema = isNode(media) ? own(media, "schema") : undefined;
        if (schema === undefined) throw new Unreadable("body-schema-missing");
        return schema;
    }

    // Swagger 2: the parameter whose `in` is "body".
    const parameters = own(post, "parameters");
    if (!Array.isArray(parameters)) throw new Unreadable("no-request-body");
    for (const entry of parameters) {
        const parameter = resolve(root, entry);
        if (isNode(parameter) && own(parameter, "in") === "body") {
            const schema = own(parameter, "schema");
            if (schema === undefined) throw new Unreadable("body-schema-missing");
            return schema;
        }
    }
    throw new Unreadable("no-request-body");
}

export function functionSignatureFromApiDescription(description: unknown, name: string): FunctionSignature {
    try {
        if (!isNode(description) || !isNode(own(description, "paths"))) throw new Unreadable("not-a-description");
        const item = own(own(description, "paths") as Node, `/rpc/${name}`);
        if (item === undefined) return { kind: "absent" };
        if (!isNode(item)) throw new Unreadable("path-malformed");
        const post = own(item, "post");
        if (post === undefined) throw new Unreadable("no-post-operation");
        if (!isNode(post)) throw new Unreadable("path-malformed");

        const schema = resolve(description, bodySchema(description, post));
        if (!isNode(schema)) throw new Unreadable("body-schema-missing");
        const properties = own(schema, "properties");
        if (!isNode(properties)) throw new Unreadable("body-schema-has-no-properties");
        return { kind: "arguments", names: Object.keys(properties) };
    } catch (error) {
        if (error instanceof Unreadable) return { kind: "unreadable", code: error.code };
        throw error;
    }
}
