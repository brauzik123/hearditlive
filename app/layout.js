import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConditionalNavBar from "../components/ConditionalNavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Heard It Live",
  description: "Your personal concert logbook",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* We apply the Geist font directly to the body here */}
      <body className={`${geistSans.className} pb-20 md:pb-0 md:pt-20`}>
        
        {/* Hidden on pre-auth screens like /login */}
        <ConditionalNavBar />
        
        {/* This is where your actual page content goes — each page renders its own <main> */}
        {children}
      </body>
    </html>
  );
}