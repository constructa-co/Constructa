import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Header from "./Header";
import { SidebarBrand } from "./sidebar-brand";

const route = vi.hoisted(() => ({ pathname: "/landing" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/lib/launch-profile", () => ({ getLaunchProfile: () => "full" }));

describe("full-profile shared wordmark (A002)", () => {
    it.each(["/landing", "/product"])("uses the existing wordmark without changing the home link on %s", pathname => {
        route.pathname = pathname;
        const html = renderToStaticMarkup(<Header />);
        const brand = renderToStaticMarkup(<SidebarBrand />);

        expect(html).toContain(brand);
        expect(html).not.toMatch(/>\s*CONSTRUCTA\s*</);
        expect(html).toContain(`<a href="/" class="text-2xl font-semibold text-white hover:opacity-90 transition-opacity">${brand}</a>`);
        expect(html).toContain(pathname === "/landing" ? "Join the waitlist" : "Features");
    });
});
