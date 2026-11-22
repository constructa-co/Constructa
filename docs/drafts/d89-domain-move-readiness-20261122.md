# D89 domain move — preparation only, 22 November

Rob owns every account, DNS, domain, alias and redirect setting. R1 changed none. No publication or form/signup activation.

## Actual production read-only check
Exact existing main deployment dpl_BRJMoW28rbsF4nep3dAz7388HPnv / 78ee1c4 is READY. Its verified alias https://constructa-nu.vercel.app returns200. Homepage title, description, og:title/description/site_name/locale(en_GB)/type(website), Twitter summary_large_image and hero image are present. Image /images/hero-image.png returns200 image/png. Pricing, privacy and website terms return200; robots and sitemap return200.

Current canonical and og:url use https://constructa-nu.vercel.app, and the image uses that alias. These match the current host but are NOT ready as the final www identity. marketingSiteOrigin uses NEXT_PUBLIC_APP_URL when present. Rob must review the existing canonical-origin setting during his move; R1 has not changed it. Do not claim final-domain metadata PASS before www is observed. Held #227 draft pages are not published by this check. An initial guessed constructa-full alias returned404; it was not the verified production target.

## After Rob moves the domain — read-only smoke checklist
1. Verify Rob's move receipt and actual current main deployment SHA, without changing settings.
2. GET https://www.constructa.co/ with valid TLS,200, Constructa's current homepage and correct content. Apex https://constructa.co/ should redirect to www; test a nested path and query for preservation and no loop. Check HTTP→HTTPS as well.
3. On homepage/pricing/privacy/terms verify canonical and og:url use https://www.constructa.co with correct path; og:image/Twitter image absolute www URL returns200 image/png; title/description/site_name/locale remain correct. Inspect robots/sitemap for www origin and private-route exclusions.
4. Check public navigation on desktop/mobile; browser back/forward and external direct links resolve. Existing review login remains separate; DO NOT create an account.
5. Apply/Contact collection stays OFF until actual mailbox test receipt and activation authority; no form submission or test mail in this smoke check. Pricing remains draft/no checkout; do not click payment/signup.
6. Record actual URL/status/redirect chain/SHA and failures. If anything fails, report the specific mismatch to Rob for his settings step; no R1 DNS/alias/env changes or automatic rollback.
