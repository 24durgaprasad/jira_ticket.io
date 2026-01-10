import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Jira Ticket Generator | AI-Powered Workflow",
    template: "%s | Jira Ticket Generator"
  },
  description: "Transform rough requirements into structured Jira Epics and Stories using advanced AI. Streamline your project management workflow.",
  keywords: ["Jira", "AI", "Project Management", "Agile", "Ticket Generator", "Automation"],
  authors: [{ name: "Jira Ticket Generator Team" }],
  creator: "Jira Ticket Generator",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://jira-ticket-generator.vercel.app",
    title: "Jira Ticket Generator | AI-Powered Workflow",
    description: "Transform rough requirements into structured Jira Epics and Stories using advanced AI.",
    siteName: "Jira Ticket Generator",
  },
  twitter: {
    card: "summary_large_image",
    title: "Jira Ticket Generator | AI-Powered Workflow",
    description: "Transform rough requirements into structured Jira Epics and Stories using advanced AI.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
