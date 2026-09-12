import { describe, expect, it } from "vitest";
import {
  NAVIGATION_PATCH_CANDIDATES,
  applyRegisteredNavigationPatch,
  diagnoseArtistsNavigation,
  runArtistsNavigationTest,
} from "@/lib/navigation-tools";

const sources = [
  {
    title: "Next.js Linking and Navigating",
    url: "https://nextjs.org/docs/app/getting-started/linking-and-navigating",
    extract: "Use a valid route path.",
    domain: "nextjs.org",
    isFallback: true,
  },
];

describe("Artists JavaScript repair flow", () => {
  it("reproduces the exception, applies a selected patch, and verifies", () => {
    const failed = runArtistsNavigationTest(false);
    expect(failed.success).toBe(false);
    expect(failed.errorName).toBe("TypeError");

    const diagnosis = diagnoseArtistsNavigation(failed, sources);
    expect(diagnosis.candidates).toHaveLength(2);
    expect(diagnosis.sources[0].domain).toBe("nextjs.org");

    const applied = applyRegisteredNavigationPatch(
      false,
      diagnosis.candidates[0],
    );
    const verified = runArtistsNavigationTest(applied);
    expect(verified).toMatchObject({
      success: true,
      destination: "/artists",
      errorName: null,
    });
  });

  it("validates both allowlisted fixes and rejects duplicate application", () => {
    for (const patch of NAVIGATION_PATCH_CANDIDATES) {
      expect(applyRegisteredNavigationPatch(false, patch)).toBe(true);
    }
    expect(() =>
      applyRegisteredNavigationPatch(true, NAVIGATION_PATCH_CANDIDATES[0]),
    ).toThrow("already applied");
  });
});
