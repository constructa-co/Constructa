import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./page";
import { SidebarBrand } from "@/components/sidebar-brand";

const auth = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: auth.createClient }));

describe("password recovery brand (A002)", () => {
    it("uses the shared wordmark while retaining the reset form and making no auth request", () => {
        const html = renderToStaticMarkup(<ForgotPasswordPage />);
        const brand = renderToStaticMarkup(<SidebarBrand />);

        expect(html).toContain(brand);
        expect(html).not.toMatch(/>\s*CONSTRUCTA\s*</);
        expect(html).toContain(`<a class="text-3xl font-bold tracking-tight" href="/">${brand}</a>`);
        expect(html).toContain("Reset your password");
        expect(html).toContain('type="email"');
        expect(html).toContain("Send reset link");
        expect(auth.createClient).not.toHaveBeenCalled();
    });
});
