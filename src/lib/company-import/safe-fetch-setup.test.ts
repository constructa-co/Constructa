import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import { describe, expect, it, vi } from "vitest";
import { pinnedRequest } from "./safe-fetch";
import { PUBLIC_V4 } from "./__fixtures__/site";

describe("pinnedRequest setup", () => {
    for (const protocol of ["http:", "https:"]) {
        for (const failure of [new TypeError("private transport setup detail"), Object.assign(new Error("socket access refused"), { code: "EPERM" })]) {
            it(`returns a safe unavailable result for ${protocol} ${failure.name} during setup`, async () => {
                const client = protocol === "https:" ? https : http;
                const request = vi.spyOn(client, "request").mockImplementation(() => { throw failure; });
                try {
                    const response = pinnedRequest({ url: new URL(`${protocol}//www.smithbuilders.co.uk/`), address: PUBLIC_V4, timeoutMs: 100, maxBytes: 1024 });
                    await expect(response).rejects.toMatchObject({ code: "unavailable", message: "The website could not be reached." });
                    expect(request).toHaveBeenCalledTimes(1);
                } finally {
                    request.mockRestore();
                }
            });
        }
    }

    for (const all of [false, true]) {
        it(`defers the pinned lookup until request handlers exist (all=${all})`, async () => {
            const fakeRequest = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });
            let constructing = true;
            let callbackDuringConstruction = false;
            let answers: unknown[] = [];
            const request = vi.spyOn(http, "request").mockImplementation(((options: http.RequestOptions) => {
                const lookup = options.lookup as (name: string, options: { all: boolean }, callback: (...values: unknown[]) => void) => void;
                lookup("www.smithbuilders.co.uk", { all }, (...values) => {
                    callbackDuringConstruction = constructing;
                    answers = values;
                });
                return fakeRequest as unknown as http.ClientRequest;
            }) as typeof http.request);
            try {
                const response = pinnedRequest({ url: new URL("http://www.smithbuilders.co.uk/"), address: PUBLIC_V4, timeoutMs: 100, maxBytes: 1024 });
                constructing = false;
                await Promise.resolve();
                fakeRequest.emit("error", new Error("connection refused"));
                await expect(response).rejects.toMatchObject({ code: "unavailable" });
                expect(callbackDuringConstruction).toBe(false);
                expect(answers).toEqual(all ? [null, [PUBLIC_V4]] : [null, PUBLIC_V4.address, PUBLIC_V4.family]);
                expect(fakeRequest.destroy).toHaveBeenCalledTimes(1);
            } finally {
                request.mockRestore();
            }
        });
    }
});
