import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Directory",
  description: "Browse all campus facilities and points of interest",
};

export default function DirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
