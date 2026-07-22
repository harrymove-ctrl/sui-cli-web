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
  url: 'https://cli.firstmovers.io',
  logo: 'https://cli.firstmovers.io/sui-logo.svg',
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
  description: 'Keyboard-first interface for First Movers on Sui blockchain. Manage addresses, transfer SUI, deploy Move smart contracts from a powerful web UI designed for developers.',
  featureList: [
    'Address Management',
    'SUI Token Transfers',
    'Move Smart Contract Deployment',
    'Transaction Inspector',
    'Gas Coin Management',
    'Multi-Environment Support',
  ],
  screenshot: 'https://cli.firstmovers.io/og-image.svg',
  softwareVersion: '1.1.0',
  downloadUrl: 'https://www.npmjs.com/package/sui-cli-web-server',
  installUrl: 'https://cli.firstmovers.io/setup',
};

// WebSite schema - For sitelinks search box
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Sui CLI Web',
  url: 'https://cli.firstmovers.io',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://cli.firstmovers.io/app?q={search_term_string}',
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
      item: 'https://cli.firstmovers.io',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Setup',
      item: 'https://cli.firstmovers.io/setup',
    },
  ],
};

// HowTo schema for Setup page
const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Install Sui CLI Web',
  description: 'Step-by-step guide to install and configure Sui CLI Web for local blockchain development.',
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
      text: 'Open https://cli.firstmovers.io in your browser',
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
  const schemas = type === 'homepage'
    ? [organizationSchema, softwareApplicationSchema, websiteSchema, faqSchema]
    : [organizationSchema, setupBreadcrumbSchema, howToSchema];

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

export default StructuredData;
