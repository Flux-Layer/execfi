import type { Metadata } from "next";

const SITE_NAME = "ExecFi";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://execfi.xyz").replace(/\/$/, "");
const DEFAULT_TITLE = "ExecFi | Consumer Crypto Gaming Hub";
const TITLE_TEMPLATE = "%s | ExecFi Gaming Hub";
const DEFAULT_DESCRIPTION =
  "ExecFi is the consumer crypto gaming hub built on Base smart wallet. Play Degen Shooter and Greenvale Farming with unified onchain XP, and instant email login.";
const DEFAULT_IMAGE = "/og/execfi-card.png";
const DEFAULT_KEYWORDS = [
  "ExecFi",
  "crypto gaming",
  "Base smart accounts",
  "gasless gameplay",
  "onchain XP",
  "Degen Shooter",
  "Greenvale Farming",
];
const TWITTER_HANDLE = "@execfiHQ";

export const seoDefaults = {
  siteName: SITE_NAME,
  siteUrl: SITE_URL,
  title: DEFAULT_TITLE,
  titleTemplate: TITLE_TEMPLATE,
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  image: DEFAULT_IMAGE,
  twitterHandle: TWITTER_HANDLE,
};

export type MetadataBuilderOptions = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  keywords?: string[];
};

export function buildMetadata(options: MetadataBuilderOptions = {}): Metadata {
  const { title, description, path, image, keywords } = options;

  const resolvedDescription = description ?? DEFAULT_DESCRIPTION;
  const resolvedKeywords = keywords ?? DEFAULT_KEYWORDS;
  const resolvedImagePath = image ?? DEFAULT_IMAGE;
  const canonical = path
    ? new URL(path.replace(/^\//, ""), `${SITE_URL}/`).toString()
    : undefined;
  const resolvedTitle = title ? `${title} | ${SITE_NAME} Gaming Hub` : DEFAULT_TITLE;
  const resolvedImage = resolvedImagePath.startsWith("http")
    ? resolvedImagePath
    : new URL(resolvedImagePath.replace(/^\//, ""), `${SITE_URL}/`).toString();

  const metadata: Metadata = {
    title: resolvedTitle,
    description: resolvedDescription,
    keywords: resolvedKeywords,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      url: canonical ?? SITE_URL,
      siteName: SITE_NAME,
      images: [resolvedImage],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
      images: [resolvedImage],
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
    },
  };

  return metadata;
}
