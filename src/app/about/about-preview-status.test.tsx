import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AboutPage from "./page";

const html = renderToStaticMarkup(<AboutPage />);
const whatsNextAnchor = html.indexOf("not currently offered for live customer work");
expect(whatsNextAnchor, "What's next copy").toBeGreaterThan(-1);
const whatsNext = html.slice(whatsNextAnchor - 400, whatsNextAnchor + 900);

describe("about preview status in What's next", () => {
  it("states phase-one review truthfully and routes preview access to pricing", () => {
    expect(whatsNext).toContain("phase-one review");
    expect(whatsNext).toContain("not currently offered for live customer work");
    expect(whatsNext).toContain("From here, we&#x27;re expanding into contracts, resource tracking, client comms, and more.");
    expect(whatsNext).toMatch(/href="\/pricing"[^>]*>Preview access →<\/a>/);
    expect(html).not.toMatch(/now live|try today|first release is now live/i);
  });
});
