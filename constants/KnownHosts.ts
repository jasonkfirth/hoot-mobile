/*
    Project: Hoot Mobile
    -------------------

    File: KnownHosts.ts

    Purpose:

        Seed the login host picker with known Lotide-compatible servers.

    Responsibilities:

        • Provide display names for well-known Lotide hosts
        • Keep host domains centralized for the login flow

    This file intentionally does NOT contain:

        • Network discovery logic
        • Login or account persistence behavior
*/

export interface KnownHost {
  name: string;
  domain: string;
}

const KnownHosts: KnownHost[] = [
  {
    name: "FBXL Lotide",
    domain: "lotide.fbxl.net",
  },
  {
    name: "Narwhal City",
    domain: "narwhal.city",
  },
  {
    name: "Narwhal City (Dev)",
    domain: "dev.narwhal.city",
  },
];

export default KnownHosts;

/* end of KnownHosts.ts */
