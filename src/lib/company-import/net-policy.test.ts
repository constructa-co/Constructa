import { describe, expect, it } from "vitest";
import { ImportFetchError, assertPublicAddresses, isPublicAddress, isWithinWebsite, parseImportUrl, resolveWithinWebsite } from "./net-policy";

const code = (run: () => unknown) => {
    try { run(); } catch (error) { return error instanceof ImportFetchError ? error.code : "threw-other"; }
    return "allowed";
};

describe("isPublicAddress", () => {
    it("accepts ordinary public addresses", () => {
        for (const address of ["93.184.216.34", "8.8.8.8", "1.1.1.1", "2606:2800:220:1:248:1893:25c8:1946", "2a00:1450:4009:81f::200e"]) {
            expect(isPublicAddress(address), address).toBe(true);
        }
    });

    it("refuses every private, local, link-local, metadata and reserved IPv4 range", () => {
        for (const address of [
            "0.0.0.0", "0.1.2.3", "10.0.0.1", "10.255.255.255", "100.64.0.1", "100.127.255.254", "127.0.0.1", "127.8.8.8",
            "169.254.169.254", "169.254.0.1", "172.16.0.1", "172.31.255.255", "192.0.0.1", "192.0.2.1", "192.88.99.1",
            "192.168.0.1", "192.168.255.255", "198.18.0.1", "198.19.255.255", "198.51.100.7", "203.0.113.7",
            "224.0.0.1", "239.255.255.255", "240.0.0.1", "255.255.255.255",
        ]) {
            expect(isPublicAddress(address), address).toBe(false);
        }
    });

    it("refuses local, private, mapped, tunnelled and reserved IPv6", () => {
        for (const address of [
            "::", "::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254", "::ffff:7f00:1", "::ffff:8.8.8.8", "64:ff9b::7f00:1",
            "fc00::1", "fd12:3456:789a::1", "fe80::1", "fe80::1%eth0", "fec0::1", "ff02::1", "2001:db8::1", "2001::1",
            "2002:7f00:1::1", "2002:a9fe:a9fe::1", "100::1", "2001:10::1", "2001:20::1",
        ]) {
            expect(isPublicAddress(address), address).toBe(false);
        }
    });

    it("refuses anything that is not plainly an address", () => {
        for (const address of ["", "localhost", "2130706433", "0x7f.0.0.1", "127.1", "010.0.0.1", "1.2.3", "1.2.3.4.5", ":::", "gggg::1", "1:2:3:4:5:6:7:8:9"]) {
            expect(isPublicAddress(address), address).toBe(false);
        }
    });
});

describe("assertPublicAddresses", () => {
    it("refuses a name with no address, and a name where any one answer is private", () => {
        expect(code(() => assertPublicAddresses("a.co.uk", []))).toBe("unavailable");
        expect(code(() => assertPublicAddresses("a.co.uk", [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }]))).toBe("unsafe-address");
        expect(code(() => assertPublicAddresses("a.co.uk", [{ address: "93.184.216.34", family: 4 }, { address: "::1", family: 6 }]))).toBe("unsafe-address");
        expect(code(() => assertPublicAddresses("a.co.uk", [{ address: "93.184.216.34", family: 4 }]))).toBe("allowed");
    });
});

describe("parseImportUrl", () => {
    it("accepts a plain website address, with or without the scheme", () => {
        expect(parseImportUrl("www.smithbuilders.co.uk").url.toString()).toBe("https://www.smithbuilders.co.uk/");
        expect(parseImportUrl(" http://SmithBuilders.co.uk/about#team ").url.toString()).toBe("http://smithbuilders.co.uk/about");
        expect(parseImportUrl("https://smithbuilders.co.uk.").host).toBe("smithbuilders.co.uk");
    });

    it("refuses credentials, other schemes and non-standard ports", () => {
        for (const url of [
            "https://user:pass@smithbuilders.co.uk/", "https://user@smithbuilders.co.uk/", "ftp://smithbuilders.co.uk/",
            "file:///etc/passwd", "javascript:alert(1)", "data:text/html,hi", "gopher://smithbuilders.co.uk/",
            "https://smithbuilders.co.uk:8443/", "http://smithbuilders.co.uk:22/", "", "   ", `https://a.co.uk/${"x".repeat(2100)}`,
        ]) {
            expect(code(() => parseImportUrl(url)), url.slice(0, 50)).toBe("invalid-url");
        }
    });

    it("refuses numeric addresses in every spelling, and local or internal names", () => {
        for (const url of [
            "http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/", "http://10.0.0.1/", "http://[::1]/", "http://[fd00::1]/",
            "http://[::ffff:169.254.169.254]/", "http://2130706433/", "http://0x7f000001/", "http://0177.0.0.1/", "http://127.1/",
            "http://8.8.8.8/", "http://localhost/", "http://intranet/", "http://router.local/", "http://db.internal/",
            "http://metadata.google.internal/", "http://app.localhost/", "http://site.test/", "http://printer.lan/", "http://x.home.arpa/",
        ]) {
            expect(code(() => parseImportUrl(url)), url).toBe("unsafe-address");
        }
    });
});

describe("website boundary", () => {
    const base = new URL("https://www.smithbuilders.co.uk/");

    it("treats the name with and without www as the same website, and nothing else", () => {
        expect(isWithinWebsite("smithbuilders.co.uk", "www.smithbuilders.co.uk")).toBe(true);
        expect(isWithinWebsite("www.smithbuilders.co.uk", "smithbuilders.co.uk")).toBe(true);
        for (const other of ["shop.smithbuilders.co.uk", "smithbuilders.co.uk.evil.com", "evilsmithbuilders.co.uk", "smithbuilders.com", "co.uk"]) {
            expect(isWithinWebsite("www.smithbuilders.co.uk", other), other).toBe(false);
        }
    });

    it("resolves links inside the website and drops everything that leaves it", () => {
        expect(resolveWithinWebsite("www.smithbuilders.co.uk", base, "/contact-us")?.url.toString()).toBe("https://www.smithbuilders.co.uk/contact-us");
        expect(resolveWithinWebsite("www.smithbuilders.co.uk", base, "https://smithbuilders.co.uk/about")?.host).toBe("smithbuilders.co.uk");
        for (const link of [
            "https://www.facebook.com/smith", "//evil.com/x", "http://169.254.169.254/", "https://user:pw@www.smithbuilders.co.uk/",
            "https://www.smithbuilders.co.uk:8080/", "javascript:alert(1)", "mailto:a@b.co", "http://localhost/", "https://www.smithbuilders.co.uk@evil.com/",
        ]) {
            expect(resolveWithinWebsite("www.smithbuilders.co.uk", base, link), link).toBeNull();
        }
    });
});
