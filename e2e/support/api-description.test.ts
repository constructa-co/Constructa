import { describe, expect, it, vi } from "vitest";
import { MAX_REFERENCE_DEPTH, functionSignatureFromApiDescription as signature } from "./api-description";

const FN = "ai_generation_reserve";
const ARGS = ["p_user_id", "p_feature", "p_reserve_output_tokens", "p_source_fingerprint"];
const properties = Object.fromEntries(ARGS.map((name) => [name, { type: "string" }]));
const schema = { type: "object", required: ARGS, properties };
const understood = { kind: "arguments", names: ARGS };
const unreadable = (code: string) => ({ kind: "unreadable", code });
const swagger = (post: unknown, rest: Record<string, unknown> = {}) => ({ swagger: "2.0", paths: { [`/rpc/${FN}`]: { post } }, ...rest });
const oas3 = (post: unknown, components: Record<string, unknown> = {}) => ({ openapi: "3.0.3", paths: { [`/rpc/${FN}`]: { post } }, components });

describe("reading a function's arguments from the API description", () => {
    /**
     * The layout in PostgREST's own v13.0.5 test suite
     * (test/spec/Feature/OpenApi/OpenApiSpec.hs): the body parameter carries
     * its schema inline. The argument names here are this project's; nothing
     * is copied from that file, and it is not a statement about what any
     * hosted project serves.
     */
    it("inline body schema, as upstream's v13.0.5 tests describe it", () => {
        const description = swagger({ parameters: [{ required: true, schema, in: "body", name: "args" }, { $ref: "#/parameters/preferParams" }] }, { parameters: { preferParams: { in: "header", name: "Prefer", type: "string" } } });
        expect(signature(description, FN)).toEqual(understood);
    });

    it("Swagger 2 with the schema behind a reference", () => {
        expect(signature(swagger({ parameters: [{ in: "body", name: "args", schema: { $ref: `#/definitions/${FN}` } }] }, { definitions: { [FN]: schema } }), FN)).toEqual(understood);
    });

    it("Swagger 2 with the parameter itself behind a reference, and its schema behind another", () => {
        const description = swagger({ parameters: [{ $ref: "#/parameters/preferParams" }, { $ref: `#/parameters/args.${FN}` }] }, {
            parameters: { preferParams: { in: "header", name: "Prefer" }, [`args.${FN}`]: { in: "body", name: "args", schema: { $ref: `#/definitions/${FN}` } } },
            definitions: { [FN]: schema },
        });
        expect(signature(description, FN)).toEqual(understood);
    });

    it("OpenAPI 3 requestBody, inline and behind references", () => {
        expect(signature(oas3({ requestBody: { content: { "application/json": { schema } } } }), FN)).toEqual(understood);
        expect(signature(oas3({ requestBody: { content: { "application/json": { schema: { $ref: `#/components/schemas/${FN}` } } } } }, { schemas: { [FN]: schema } }), FN)).toEqual(understood);
        expect(signature(oas3({ requestBody: { $ref: "#/components/requestBodies/reserve" } }, {
            requestBodies: { reserve: { content: { "application/json": { schema: { $ref: `#/components/schemas/${FN}` } } } } },
            schemas: { [FN]: schema },
        }), FN)).toEqual(understood);
        // Another media type is used when JSON is not offered.
        expect(signature(oas3({ requestBody: { content: { "application/vnd.pgrst.object+json": { schema } } } }), FN)).toEqual(understood);
    });

    it("follows a chain of references, and decodes JSON Pointer and percent escapes", () => {
        const chained = swagger({ parameters: [{ in: "body", schema: { $ref: "#/definitions/a" } }] }, { definitions: { a: { $ref: "#/definitions/b" }, b: { $ref: "#/definitions/c" }, c: schema } });
        expect(signature(chained, FN)).toEqual(understood);

        const escaped = swagger({ parameters: [{ in: "body", schema: { $ref: "#/definitions/rpc~1args~0v2" } }, { in: "body", schema: {} }] }, { definitions: { "rpc/args~v2": schema } });
        expect(signature(escaped, FN)).toEqual(understood);
        const percent = swagger({ parameters: [{ in: "body", schema: { $ref: "#/definitions/my%20args" } }] }, { definitions: { "my args": schema } });
        expect(signature(percent, FN)).toEqual(understood);
        // `~01` is a literal "~1", not a slash.
        const literal = swagger({ parameters: [{ in: "body", schema: { $ref: "#/definitions/a~01" } }] }, { definitions: { "a~1": schema } });
        expect(signature(literal, FN)).toEqual(understood);
    });

    it("a function that is not in the description is absent, which is different from unreadable", () => {
        expect(signature(swagger({ parameters: [{ in: "body", schema }] }), "ai_generation_finish")).toEqual({ kind: "absent" });
        expect(signature({ paths: {} }, FN)).toEqual({ kind: "absent" });
    });

    it("a schema that is understood but lacks an argument is reported with the names it does have", () => {
        const older = { type: "object", properties: { p_user_id: {}, p_feature: {} } };
        expect(signature(swagger({ parameters: [{ in: "body", schema: older }] }), FN)).toEqual({ kind: "arguments", names: ["p_user_id", "p_feature"] });
        expect(signature(oas3({ requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/x" } } } } }, { schemas: { x: older } }), FN)).toEqual({ kind: "arguments", names: ["p_user_id", "p_feature"] });
        expect(signature(swagger({ parameters: [{ in: "body", schema: { type: "object", properties: {} } }] }), FN)).toEqual({ kind: "arguments", names: [] });
    });

    it.each([
        ["nothing", null, "not-a-description"],
        ["text", "<html>", "not-a-description"],
        ["a list", [], "not-a-description"],
        ["no paths", { swagger: "2.0" }, "not-a-description"],
        ["paths that are not an object", { paths: [] }, "not-a-description"],
        ["a path that is not an object", { paths: { [`/rpc/${FN}`]: "x" } }, "path-malformed"],
        ["a path with no POST", { paths: { [`/rpc/${FN}`]: { get: {} } } }, "no-post-operation"],
        ["a POST that is not an object", { paths: { [`/rpc/${FN}`]: { post: [] } } }, "path-malformed"],
        ["a POST with no parameters or body", swagger({}), "no-request-body"],
        ["parameters that are not a list", swagger({ parameters: {} }), "no-request-body"],
        ["no body parameter among the parameters", swagger({ parameters: [{ in: "header", name: "Prefer" }, null, "x"] }), "no-request-body"],
        ["a body parameter with no schema", swagger({ parameters: [{ in: "body", name: "args" }] }), "body-schema-missing"],
        ["a schema that is not an object", swagger({ parameters: [{ in: "body", schema: "object" }] }), "body-schema-missing"],
        ["a schema with no properties", swagger({ parameters: [{ in: "body", schema: { type: "object" } }] }), "body-schema-has-no-properties"],
        ["properties that are a list", swagger({ parameters: [{ in: "body", schema: { properties: ARGS } }] }), "body-schema-has-no-properties"],
        ["a requestBody with no content", oas3({ requestBody: {} }), "body-schema-missing"],
        ["a requestBody whose media type has no schema", oas3({ requestBody: { content: { "application/json": {} } } }), "body-schema-missing"],
    ])("%s is unreadable, never 'takes no arguments'", (_label, description, code) => {
        expect(signature(description, FN)).toEqual(unreadable(code));
    });

    it.each([
        ["unresolved", "#/definitions/missing", "reference-unresolved"],
        ["into a value that is not an object", "#/definitions/leaf/deeper", "reference-unresolved"],
        ["to another document", "other.json#/definitions/x", "reference-external"],
        ["to a web address", "https://elsewhere.example/spec.json#/definitions/x", "reference-external"],
        ["to a file", "file:///etc/passwd", "reference-external"],
        ["to the whole document", "#", "reference-malformed"],
        ["without a pointer", "#definitions/x", "reference-malformed"],
        ["with a broken percent escape", "#/definitions/%E0%A4%A", "reference-malformed"],
        ["empty", "", "reference-malformed"],
        ["a number", 7, "reference-malformed"],
        ["to somewhere it has no business", "#/paths/~1rpc~1other/post", "reference-not-allowed"],
        ["to the info block", "#/info", "reference-not-allowed"],
        ["to a root with nothing after it", "#/definitions/", "reference-not-allowed"],
        ["through the prototype", "#/definitions/__proto__", "reference-unresolved"],
        ["through a constructor", "#/definitions/constructor/prototype", "reference-unresolved"],
    ])("a reference %s is refused", (_label, reference, code) => {
        const description = swagger({ parameters: [{ in: "body", schema: { $ref: reference } }] }, { definitions: { leaf: "text" }, info: { properties } });
        expect(signature(description, FN)).toEqual(unreadable(code));
    });

    it("circular references are refused: to itself, in a ring, and from a parameter", () => {
        const body = (reference: string) => ({ parameters: [{ in: "body", schema: { $ref: reference } }] });
        expect(signature(swagger(body("#/definitions/a"), { definitions: { a: { $ref: "#/definitions/a" } } }), FN)).toEqual(unreadable("reference-circular"));
        expect(signature(swagger(body("#/definitions/a"), { definitions: { a: { $ref: "#/definitions/b" }, b: { $ref: "#/definitions/c" }, c: { $ref: "#/definitions/a" } } }), FN)).toEqual(unreadable("reference-circular"));
        expect(signature(swagger({ parameters: [{ $ref: "#/parameters/p" }] }, { parameters: { p: { $ref: "#/parameters/p" } } }), FN)).toEqual(unreadable("reference-circular"));
    });

    it(`follows at most ${MAX_REFERENCE_DEPTH} references in a row`, () => {
        const chain = (length: number) => {
            const definitions: Record<string, unknown> = { [`d${length}`]: schema };
            for (let index = 0; index < length; index += 1) definitions[`d${index}`] = { $ref: `#/definitions/d${index + 1}` };
            return swagger({ parameters: [{ in: "body", schema: definitions.d0 }] }, { definitions });
        };
        expect(signature(chain(MAX_REFERENCE_DEPTH), FN)).toEqual(understood);
        expect(signature(chain(MAX_REFERENCE_DEPTH + 1), FN)).toEqual(unreadable("reference-too-deep"));
        expect(signature(chain(500), FN)).toEqual(unreadable("reference-too-deep"));
    });

    it("never fetches anything, whatever a reference says", () => {
        const fetched = vi.fn();
        vi.stubGlobal("fetch", fetched);
        try {
            for (const reference of ["https://elsewhere.example/a.json", "http://127.0.0.1:1/x#/definitions/y", "//elsewhere.example/a", "other.json"]) {
                expect(signature(swagger({ parameters: [{ in: "body", schema: { $ref: reference } }] }), FN)).toEqual(unreadable("reference-external"));
            }
            expect(fetched).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it("does not change the description it reads", () => {
        const description = swagger({ parameters: [{ in: "body", schema: { $ref: `#/definitions/${FN}` } }] }, { definitions: { [FN]: schema } });
        const before = JSON.stringify(description);
        signature(description, FN);
        expect(JSON.stringify(description)).toBe(before);
    });
});
