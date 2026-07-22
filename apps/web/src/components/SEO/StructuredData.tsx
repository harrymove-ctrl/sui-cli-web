/**
 * JSON-LD Structured Data for SEO
 * Provides rich snippets for search engines
 */

interface StructuredDataProps {
  type?: 'homepage' | 'setup';
}

// Organization schema - Company/Project info
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Sui CLI Web',
  url: 'https://sui-cli-web-production.up.railway.app',
  logo: 'https://sui-cli-web-production.up.railway.app/sui-logo.svg',
  sameAs: [
    'https://github.com/hien-p/raycast-sui-cli',
    'https://www.npmjs.com/package/sui-cli-web-server',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'technical support',
    url: 'https://github.com/hien-p/raycast-sui-cli/issues',
  },
};

// Software Application schema - App metadata for Google rich results
const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Sui CLI Web',
  applicationCategory: 'DeveloperApplication',
  applicationSubCategory: 'Blockchain Development Tools',
  operatingSystem: 'Web Browser, macOS, Windows, Linux',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Keyboard-first interface for First Movers on Sui blockchain. Manage addresses, transfer SUI, deploy Move smart contracts from a powerful web UI designed for developers.',
  featureList: [
    'Address Management',
    'SUI Token Transfers',
    'Move Smart Contract Deployment',
    'Transaction Inspector',
    'Gas Coin Management',
    'Multi-Environment Support',
  ],
  screenshot: 'https://sui-cli-web-production.up.railway.app/og-image.svg',
  softwareVersion: '1.1.0',
  downloadUrl: 'https://www.npmjs.com/package/sui-cli-web-server',
  installUrl: 'https://sui-cli-web-production.up.railway.app/setup',
};

// WebSite schema - For sitelinks search box
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Sui CLI Web',
  url: 'https://sui-cli-web-production.up.railway.app',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://sui-cli-web-production.up.railway.app/app?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};

// Breadcrumb schema for Setup page
const setupBreadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://sui-cli-web-production.up.railway.app',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Setup',
      item: 'https://sui-cli-web-production.up.railway.app/setup',
    },
  ],
};

// HowTo schema for Setup page
const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Install Sui CLI Web',
  description:
    'Step-by-step guide to install and configure Sui CLI Web for local blockchain development.',
  totalTime: 'PT5M',
  tool: [
    {
      '@type': 'HowToTool',
      name: 'Node.js',
    },
    {
      '@type': 'HowToTool',
      name: 'npm',
    },
    {
      '@type': 'HowToTool',
      name: 'Sui CLI',
    },
  ],
  step: [
    {
      '@type': 'HowToStep',
      name: 'Install Sui CLI',
      text: 'Install the Sui CLI using cargo or the official installer',
      url: 'https://docs.sui.io/guides/developer/getting-started/sui-install',
    },
    {
      '@type': 'HowToStep',
      name: 'Install Sui CLI Web Server',
      text: 'Run: npx sui-cli-web-server',
    },
    {
      '@type': 'HowToStep',
      name: 'Access the Web Interface',
      text: 'Open https://sui-cli-web-production.up.railway.app in your browser',
    },
  ],
};

// FAQ schema for common questions
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is Sui CLI Web free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, Sui CLI Web is completely free and open source. It provides a web-based interface for the Sui blockchain CLI.',
      },
    },
    {
      '@type': 'Question',
      name: 'Are my private keys safe?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, your private keys never leave your local machine. The server runs locally on your computer and communicates directly with your Sui CLI installation.',
      },
    },
    {
      '@type': 'Question',
      name: 'What can I do with Sui CLI Web?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You can manage Sui addresses, transfer SUI tokens, deploy and interact with Move smart contracts, inspect transactions, and manage gas coins - all from a beautiful web interface.',
      },
    },
  ],
};

export function StructuredData({ type = 'homepage' }: StructuredDataProps) {
  const schemas =
    type === 'homepage'
      ? [organizationSchema, softwareApplicationSchema, websiteSchema, faqSchema]
      : [organizationSchema, setupBreadcrumbSchema, howToSchema];

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          // JSON-LD has to be the raw body of a script tag; the value is
          // built here from literals, never from user input.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org payload, not user content.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

export default StructuredData;
