import type { Metadata } from "next";

export const appBaseUrl = "https://seller.housingpa.com";

export type SeoPage = {
  slug: string;
  metaTitle: string;
  description: string;
  h1: string;
  directAnswer: string;
  audience: string[];
  problems: string[];
  features: string[];
  workflow: string[];
  faqs: Array<{ question: string; answer: string }>;
  comparison?: Array<{ label: string; manual: string; app: string }>;
};

const sellerFaqs = [
  ["What is SellerAI?", "SellerAI is an AI-assisted seller workflow from Housing Pro Assets that helps organize pricing strategy, listing preparation, seller reports, required notices, and agent-led next steps."],
  ["Who is SellerAI built for?", "SellerAI is built for home sellers, listing agents, brokers, real estate teams, investors preparing to sell, and operations teams that need a structured seller intake workflow."],
  ["Does SellerAI replace a real estate professional?", "No. SellerAI supports broker-led decision making. It organizes property intelligence and workflow steps while licensed professionals stay in control."],
  ["How does SellerAI use AI?", "SellerAI uses AI to help understand the property, collect seller goals, prepare pricing and listing guidance, organize documents, and support agent review."],
  ["Can SellerAI help with listing preparation?", "Yes. It can organize seller tasks such as lockbox, photos, showings, yard sign choices, disclosures, and listing agreement preparation."],
  ["How does SellerAI connect to Housing Pro Assets?", "SellerAI is part of Housing Pro Assets, the ecosystem for AI, automation, valuation, offers, brokerage operations, and property intelligence."],
  ["Is SellerAI only for residential sellers?", "SellerAI is primarily focused on seller workflows, especially residential listing preparation, but it can connect to other Housing Pro Assets tools for commercial and investment analysis."],
  ["How do I get started?", "Start from the SellerAI homepage, request a strategy session, or connect through Housing Pro Assets for an automation review."],
].map(([question, answer]) => ({ question, answer }));

export const seoPages: Record<string, SeoPage> = {
  "seller-tools": {
    slug: "seller-tools",
    metaTitle: "SellerAI Seller Tools | Housing Pro Assets",
    description: "AI-assisted seller reports, pricing strategy, listing preparation, disclosures, and broker-led sale workflow tools.",
    h1: "AI-assisted seller tools for pricing and listing preparation",
    directAnswer: "SellerAI helps sellers and agents organize property information, pricing strategy, listing preparation, required notices, disclosures, and next steps in a broker-led workflow.",
    audience: ["Home sellers", "Listing agents", "Real estate brokers", "Investor sellers", "Real estate operations teams"],
    problems: ["Unclear seller expectations", "Manual CMA preparation", "Scattered documents", "Slow listing prep", "Confusing next steps"],
    features: ["Seller intake", "Pricing strategy support", "Listing preparation workflow", "Consumer notice workflow", "Agent approval dashboard", "Document milestone tracking"],
    workflow: ["Seller enters an address.", "SellerAI captures goals and property details.", "The agent reviews required documents and releases progress.", "SellerAI prepares the next listing step.", "The property record stays organized for the sale workflow."],
    faqs: sellerFaqs,
    comparison: [
      { label: "Pricing", manual: "Manual CMA notes and spreadsheets", app: "AI-assisted seller report and pricing strategy" },
      { label: "Documents", manual: "Email threads and reminders", app: "Milestone list for notices, listing agreement, disclosures, and future e-signs" },
      { label: "Next steps", manual: "Agent explains repeatedly", app: "Structured seller workflow with agent release points" },
    ],
  },
  "seller-report-vs-cma": {
    slug: "seller-report-vs-cma",
    metaTitle: "Seller Report vs CMA | SellerAI",
    description: "Compare a SellerAI seller report with a traditional CMA for pricing, preparation, and listing strategy.",
    h1: "SellerAI seller report vs traditional CMA",
    directAnswer: "A CMA focuses on comparable sales. A SellerAI seller report can include pricing strategy, property preparation, seller goals, task workflow, and document readiness in one broker-led process.",
    audience: ["Sellers", "Listing agents", "Brokerages", "Real estate teams"],
    problems: ["CMA alone may not explain preparation", "Sellers need next steps", "Listing tasks are not connected to pricing"],
    features: ["CMA-style pricing context", "Seller goals", "Preparation tasks", "Document workflow", "Agent review"],
    workflow: ["Analyze the property.", "Compare market data.", "Collect seller goals.", "Create listing preparation tasks.", "Move toward agent-reviewed documents."],
    faqs: sellerFaqs,
    comparison: [
      { label: "Scope", manual: "Comparable sales and price opinion", app: "Pricing plus preparation and workflow" },
      { label: "User experience", manual: "Static PDF or spreadsheet", app: "Interactive seller path" },
      { label: "Agent role", manual: "Separate follow-up", app: "Agent approval and release points" },
    ],
  },
  "seller-tools/philadelphia": {
    slug: "seller-tools/philadelphia",
    metaTitle: "Philadelphia Seller Tools | SellerAI",
    description: "AI-assisted seller reports and listing preparation for Philadelphia and Pennsylvania real estate professionals.",
    h1: "Philadelphia seller tools for listing preparation",
    directAnswer: "SellerAI supports Philadelphia-area sellers and listing agents with pricing strategy, preparation workflow, seller documents, and broker-led next steps.",
    audience: ["Philadelphia sellers", "Northeast Philadelphia agents", "Pennsylvania brokers", "Investor sellers"],
    problems: ["Local pricing uncertainty", "Listing prep delays", "Document timing", "Seller education"],
    features: ["Local seller intake", "Pricing context", "Listing prep tasks", "Agent document dashboard", "Housing Pro Assets links"],
    workflow: ["Enter the property address.", "Review seller goals.", "Prepare pricing and listing guidance.", "Agent reviews documents.", "Seller moves toward listing launch."],
    faqs: sellerFaqs,
    comparison: [
      { label: "Local workflow", manual: "Manual agent follow-up", app: "Structured Philadelphia seller path" },
      { label: "Preparation", manual: "Loose checklist", app: "Task-based listing preparation" },
      { label: "Documents", manual: "Email reminders", app: "Agent-monitored milestones" },
    ],
  },
};

export const ecosystemLinks = [
  ["Housing Pro Assets", "https://housingpa.com/"],
  ["Solutions", "https://housingpa.com/solutions/"],
  ["Valuator", "https://housingpa.com/valuator.html"],
  ["Automation audit", "https://housingpa.com/automation-audit/"],
  ["Contact", "https://housingpa.com/contact/"],
  ["SellerAI", "https://seller.housingpa.com/"],
  ["Real estate AI", "https://housingpa.com/real-estate-ai/"],
  ["Property intelligence", "https://housingpa.com/property-intelligence/"],
].map(([label, href]) => ({ label, href }));

export function pageMetadata(page: SeoPage): Metadata {
  const canonical = `${appBaseUrl}/${page.slug}`;
  return {
    title: { absolute: page.metaTitle },
    description: page.description,
    alternates: { canonical },
    openGraph: { title: page.metaTitle, description: page.description, url: canonical, siteName: "SellerAI by Housing Pro Assets", type: "website" },
    twitter: { card: "summary_large_image", title: page.metaTitle, description: page.description },
  };
}

export function schemaForPage(page: SeoPage) {
  const url = `${appBaseUrl}/${page.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": "https://housingpa.com/#organization", name: "Housing Pro Assets", alternateName: "HousingPA", url: "https://housingpa.com/" },
      { "@type": "RealEstateAgent", "@id": "https://housingpa.com/#american-vista", name: "American Vista Real Estate", parentOrganization: { "@id": "https://housingpa.com/#organization" } },
      { "@type": ["SoftwareApplication", "WebApplication", "Product"], "@id": `${appBaseUrl}/#sellerai`, name: "SellerAI", applicationCategory: "BusinessApplication", operatingSystem: "Web", provider: { "@id": "https://housingpa.com/#organization" }, description: page.directAnswer },
      { "@type": "WebPage", "@id": `${url}#webpage`, url, name: page.metaTitle, description: page.description, about: { "@id": `${appBaseUrl}/#sellerai` } },
      { "@type": "FAQPage", "@id": `${url}#faq`, mainEntity: page.faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) },
      { "@type": "HowTo", "@id": `${url}#howto`, name: `How ${page.h1} works`, step: page.workflow.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })) },
    ],
  };
}
