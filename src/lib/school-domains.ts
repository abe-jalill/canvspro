/**
 * School directory and domain auto-detection for Canvas LMS instances.
 * Maps university email domains and names to their corresponding Canvas URLs.
 */

export interface SchoolInfo {
  name: string;
  emailDomain: string;
  canvasDomain: string;
}

export const KNOWN_SCHOOLS: SchoolInfo[] = [
  { name: "Lawrence Technological University", emailDomain: "ltu.edu", canvasDomain: "ltu.instructure.com" },
  { name: "University of Michigan", emailDomain: "umich.edu", canvasDomain: "umich.instructure.com" },
  { name: "Michigan State University", emailDomain: "msu.edu", canvasDomain: "msu.instructure.com" },
  { name: "Wayne State University", emailDomain: "wayne.edu", canvasDomain: "canvas.wayne.edu" },
  { name: "University of Florida", emailDomain: "ufl.edu", canvasDomain: "ufl.instructure.com" },
  { name: "Florida State University", emailDomain: "fsu.edu", canvasDomain: "canvas.fsu.edu" },
  { name: "University of Central Florida", emailDomain: "ucf.edu", canvasDomain: "ucf.instructure.com" },
  { name: "University of South Florida", emailDomain: "usf.edu", canvasDomain: "usflearn.instructure.com" },
  { name: "Ohio State University", emailDomain: "osu.edu", canvasDomain: "canvas.osu.edu" },
  { name: "Penn State University", emailDomain: "psu.edu", canvasDomain: "psu.instructure.com" },
  { name: "Rutgers University", emailDomain: "rutgers.edu", canvasDomain: "canvas.rutgers.edu" },
  { name: "University of Texas at Austin", emailDomain: "utexas.edu", canvasDomain: "utexas.instructure.com" },
  { name: "Texas A&M University", emailDomain: "tamu.edu", canvasDomain: "canvas.tamu.edu" },
  { name: "Harvard University", emailDomain: "harvard.edu", canvasDomain: "canvas.harvard.edu" },
  { name: "Yale University", emailDomain: "yale.edu", canvasDomain: "yale.instructure.com" },
  { name: "Stanford University", emailDomain: "stanford.edu", canvasDomain: "canvas.stanford.edu" },
  { name: "MIT", emailDomain: "mit.edu", canvasDomain: "canvas.mit.edu" },
  { name: "UC Berkeley", emailDomain: "berkeley.edu", canvasDomain: "bcourses.berkeley.edu" },
  { name: "UCLA", emailDomain: "ucla.edu", canvasDomain: "bruinlearn.ucla.edu" },
  { name: "UC San Diego", emailDomain: "ucsd.edu", canvasDomain: "canvas.ucsd.edu" },
  { name: "UC Davis", emailDomain: "ucdavis.edu", canvasDomain: "canvas.ucdavis.edu" },
  { name: "UC Irvine", emailDomain: "uci.edu", canvasDomain: "canvas.eee.uci.edu" },
  { name: "UC Santa Barbara", emailDomain: "ucsb.edu", canvasDomain: "ucsb.instructure.com" },
  { name: "UC Santa Cruz", emailDomain: "ucsc.edu", canvasDomain: "canvas.ucsc.edu" },
  { name: "Georgia Tech", emailDomain: "gatech.edu", canvasDomain: "gatech.instructure.com" },
  { name: "Virginia Tech", emailDomain: "vt.edu", canvasDomain: "canvas.vt.edu" },
  { name: "University of Virginia", emailDomain: "virginia.edu", canvasDomain: "canvas.its.virginia.edu" },
  { name: "University of Washington", emailDomain: "uw.edu", canvasDomain: "canvas.uw.edu" },
  { name: "Indiana University", emailDomain: "iu.edu", canvasDomain: "canvas.iu.edu" },
  { name: "Purdue University", emailDomain: "purdue.edu", canvasDomain: "purdue.brightspace.com" }, // noted for disambiguation
  { name: "University of Minnesota", emailDomain: "umn.edu", canvasDomain: "canvas.umn.edu" },
  { name: "University of Wisconsin-Madison", emailDomain: "wisc.edu", canvasDomain: "canvas.wisc.edu" },
  { name: "Northwestern University", emailDomain: "northwestern.edu", canvasDomain: "canvas.northwestern.edu" },
  { name: "University of Chicago", emailDomain: "uchicago.edu", canvasDomain: "canvas.uchicago.edu" },
  { name: "Cornell University", emailDomain: "cornell.edu", canvasDomain: "canvas.cornell.edu" },
  { name: "Columbia University", emailDomain: "columbia.edu", canvasDomain: "courseworks2.columbia.edu" },
  { name: "University of Pennsylvania", emailDomain: "upenn.edu", canvasDomain: "canvas.upenn.edu" },
  { name: "Brown University", emailDomain: "brown.edu", canvasDomain: "canvas.brown.edu" },
  { name: "Dartmouth College", emailDomain: "dartmouth.edu", canvasDomain: "canvas.dartmouth.edu" },
  { name: "Georgetown University", emailDomain: "georgetown.edu", canvasDomain: "georgetown.instructure.com" },
  { name: "Johns Hopkins University", emailDomain: "jhu.edu", canvasDomain: "canvas.jhu.edu" },
  { name: "Emory University", emailDomain: "emory.edu", canvasDomain: "canvas.emory.edu" },
  { name: "Rice University", emailDomain: "rice.edu", canvasDomain: "canvas.rice.edu" },
  { name: "Auburn University", emailDomain: "auburn.edu", canvasDomain: "auburn.instructure.com" },
  { name: "Clemson University", emailDomain: "clemson.edu", canvasDomain: "clemson.instructure.com" },
  { name: "UNC Chapel Hill", emailDomain: "unc.edu", canvasDomain: "canvas.unc.edu" },
  { name: "UNC Charlotte", emailDomain: "uncc.edu", canvasDomain: "uncc.instructure.com" },
  { name: "Arizona State University", emailDomain: "asu.edu", canvasDomain: "canvas.asu.edu" },
  { name: "University of Arizona", emailDomain: "arizona.edu", canvasDomain: "arizona.instructure.com" },
  { name: "University of Colorado Boulder", emailDomain: "colorado.edu", canvasDomain: "canvas.colorado.edu" },
  { name: "University of Utah", emailDomain: "utah.edu", canvasDomain: "utah.instructure.com" },
  { name: "Utah State University", emailDomain: "usu.edu", canvasDomain: "usu.instructure.com" },
  { name: "Brigham Young University", emailDomain: "byu.edu", canvasDomain: "byu.instructure.com" },
  { name: "Notre Dame", emailDomain: "nd.edu", canvasDomain: "canvas.nd.edu" },
];

/**
 * Detects the likely Canvas domain given an email address.
 * 1. Matches exact known email domains (e.g. ltu.edu -> ltu.instructure.com).
 * 2. If it's any .edu domain, defaults to `<school>.instructure.com`.
 */
export function detectCanvasDomainFromEmail(email: string | null | undefined): {
  canvasDomain: string;
  schoolName: string;
  source: "known" | "inferred";
} | null {
  if (!email || !email.includes("@")) return null;
  const parts = email.split("@");
  if (parts.length < 2) return null;

  const domainPart = parts[1].toLowerCase().trim();
  // Strip subdomains like mail.umich.edu -> umich.edu
  const domainSegments = domainPart.split(".");
  if (domainSegments.length < 2) return null;

  const baseDomain = domainSegments.slice(-2).join(".");

  // 1. Check known schools first
  const known = KNOWN_SCHOOLS.find(
    (s) => s.emailDomain === domainPart || s.emailDomain === baseDomain,
  );
  if (known) {
    return {
      canvasDomain: known.canvasDomain,
      schoolName: known.name,
      source: "known",
    };
  }

  // 2. If it ends in .edu, infer [subdomain].instructure.com
  if (domainPart.endsWith(".edu")) {
    const schoolSlug = domainSegments[domainSegments.length - 2];
    if (schoolSlug && schoolSlug.length >= 2) {
      return {
        canvasDomain: `${schoolSlug}.instructure.com`,
        schoolName: schoolSlug.toUpperCase(),
        source: "inferred",
      };
    }
  }

  return null;
}

/**
 * Direct link to the Canvas token generation page for a given school domain.
 * Canvas routes /profile/settings#access_tokens right to the user's Approved Integrations section.
 */
export function getCanvasTokenSettingsUrl(domain: string | null | undefined): string {
  if (!domain) return "https://canvas.instructure.com/profile/settings#access_tokens";
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${cleanDomain}/profile/settings#access_tokens`;
}
