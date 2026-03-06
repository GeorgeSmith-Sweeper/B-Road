import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import ToasterProvider from "@/components/ToasterProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Roadrunner - Discover the Best Driving Roads",
  description: "Plan your perfect road trip by selecting the most scenic, thrilling, and unforgettable driving roads — one waypoint at a time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#C8A55A",
          colorBackground: "#1A1A1A",
          colorText: "#E8E8E8",
          colorTextSecondary: "#B0B0B0",
          colorNeutral: "#E8E8E8",
          colorTextOnPrimaryBackground: "#0D0D0D",
        },
        elements: {
          userButtonPopoverCard: {
            backgroundColor: "#1A1A1A",
            borderColor: "#333",
            color: "#E8E8E8",
          },
          userButtonPopoverMain: {
            color: "#E8E8E8",
          },
          userButtonPopoverActionButton: {
            color: "#E8E8E8",
          },
          userButtonPopoverActionButtonText: {
            color: "#E8E8E8",
          },
          userButtonPopoverActionButtonIcon: {
            color: "#B0B0B0",
          },
          userPreviewMainIdentifier: {
            color: "#E8E8E8",
          },
          userPreviewSecondaryIdentifier: {
            color: "#B0B0B0",
          },
          // UserProfile (Manage account) modal
          modalBackdrop: {
            backgroundColor: "rgba(0, 0, 0, 0.7)",
          },
          modalContent: {
            backgroundColor: "#1A1A1A",
            color: "#E8E8E8",
          },
          card: {
            backgroundColor: "#1A1A1A",
            color: "#E8E8E8",
            borderColor: "#333",
          },
          navbar: {
            backgroundColor: "#141414",
            borderColor: "#333",
          },
          navbarButton: {
            color: "#E8E8E8",
          },
          navbarButtonIcon: {
            color: "#B0B0B0",
          },
          pageScrollBox: {
            backgroundColor: "#1A1A1A",
          },
          page: {
            color: "#E8E8E8",
          },
          profileSectionTitle: {
            color: "#E8E8E8",
            borderColor: "#333",
          },
          profileSectionTitleText: {
            color: "#E8E8E8",
          },
          profileSectionContent: {
            color: "#E8E8E8",
          },
          profileSectionPrimaryButton: {
            color: "#C8A55A",
          },
          formFieldLabel: {
            color: "#E8E8E8",
          },
          formFieldInput: {
            backgroundColor: "#2A2A2A",
            color: "#E8E8E8",
            borderColor: "#444",
          },
          headerTitle: {
            color: "#E8E8E8",
          },
          headerSubtitle: {
            color: "#B0B0B0",
          },
        },
      }}
    >
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,400;1,400&display=swap"
            rel="stylesheet"
          />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
          <ToasterProvider />
        </body>
      </html>
    </ClerkProvider>
  );
}
