import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskSummarizer — Daily Dev Updates",
  description:
    "AI-powered daily task update summarizer for developer teams. Paste your raw updates and get a clean, formatted summary instantly.",
  keywords: ["task summarizer", "daily standup", "developer updates", "AI summary"],
  authors: [{ name: "TaskSummarizer" }],
  openGraph: {
    title: "TaskSummarizer — Daily Dev Updates",
    description: "AI-powered daily task update summarizer for developer teams.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#020617" />
      </head>
      <body className="animated-bg min-h-screen text-slate-200 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
