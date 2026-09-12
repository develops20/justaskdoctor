import {
  NavigationPatchSchema,
  type NavigationPatch,
  type ResearchSource,
} from "@/lib/contracts";

export interface NavigationTestResult {
  success: boolean;
  destination: string | null;
  errorName: string | null;
  errorMessage: string | null;
  evidence: Array<{ label: string; value: string }>;
}

export interface NavigationDiagnosis {
  summaryForOwner: string;
  technicalCause: string;
  confidence: "high";
  evidence: Array<{ label: string; value: string }>;
  candidates: NavigationPatch[];
  sources: ResearchSource[];
}

export const NAVIGATION_PATCH_CANDIDATES: NavigationPatch[] = [
  {
    type: "FIX_ARTISTS_ROUTE",
    strategy: "correct-route-key",
    file: "components/salon/SalonExperience.tsx",
    before: "routes.artist.toLowerCase()",
    after: "routes.artists",
  },
  {
    type: "FIX_ARTISTS_ROUTE",
    strategy: "safe-fallback",
    file: "components/salon/SalonExperience.tsx",
    before: "routes.artist.toLowerCase()",
    after: 'routes.artist?.toLowerCase() ?? "/artists"',
  },
];

export function runArtistsNavigationTest(
  patchApplied: boolean,
): NavigationTestResult {
  if (!patchApplied) {
    return {
      success: false,
      destination: null,
      errorName: "TypeError",
      errorMessage:
        "Cannot read properties of undefined (reading 'toLowerCase')",
      evidence: [
        { label: "Clicked link", value: "Artists" },
        { label: "Expected route", value: "/artists" },
        { label: "Observed route", value: "Stayed on /book" },
        {
          label: "JavaScript exception",
          value: "routes.artist is undefined",
        },
      ],
    };
  }

  return {
    success: true,
    destination: "/artists",
    errorName: null,
    errorMessage: null,
    evidence: [
      { label: "Clicked link", value: "Artists" },
      { label: "Resolved route", value: "/artists" },
      { label: "JavaScript exception", value: "None" },
    ],
  };
}

export function diagnoseArtistsNavigation(
  result: NavigationTestResult,
  sources: ResearchSource[],
): NavigationDiagnosis {
  if (result.success || result.errorName !== "TypeError") {
    throw new Error("The registered Artists-link diagnosis did not match.");
  }
  return {
    summaryForOwner:
      "The Artists menu points to a route name that does not exist. The artists page itself is healthy, but the click fails before the browser can open it.",
    technicalCause:
      "The click handler reads routes.artist, but the route map defines routes.artists. Calling toLowerCase() on the missing value throws a TypeError.",
    confidence: "high",
    evidence: result.evidence,
    candidates: NAVIGATION_PATCH_CANDIDATES,
    sources,
  };
}

export function applyRegisteredNavigationPatch(
  currentPatchApplied: boolean,
  patch: NavigationPatch,
): true {
  if (currentPatchApplied) {
    throw new Error("The Artists navigation patch was already applied.");
  }
  NavigationPatchSchema.parse(patch);
  return true;
}
