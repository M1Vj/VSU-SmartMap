import type { Metadata } from "next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Github } from "lucide-react";

export const metadata: Metadata = {
  title: "Information",
  description: "About Campus SmartMap for VSU, FAQ, Terms, and Privacy Policy.",
};

export default function InfoPage() {
  return (
    <main className="h-full overflow-y-auto">
      <div className="container mx-auto max-w-7xl space-y-8 py-6 md:py-10">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-bold tracking-tighter md:text-4xl">Information Hub</h1>
          <p className="mx-auto max-w-[700px] text-muted-foreground">
            Learn more about the Campus SmartMap for VSU project, our mission, and legal policies.
          </p>
        </div>

        <Tabs defaultValue="about" className="w-full">
          <div className="mb-8 flex justify-center">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-5">
              <TabsTrigger value="about" className="px-6">About</TabsTrigger>
              <TabsTrigger value="faq" className="px-6">FAQ</TabsTrigger>
              <TabsTrigger value="terms" className="px-6">Terms</TabsTrigger>
              <TabsTrigger value="privacy" className="px-6">Privacy</TabsTrigger>
              <TabsTrigger value="contact" className="px-6">Contact</TabsTrigger>
            </TabsList>
          </div>

        {/* ABOUT CONTENT */}
        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>About Campus SmartMap for VSU</CardTitle>
              <CardDescription>
                Navigating Visayas State University made easy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                Campus SmartMap for VSU is an unofficial, student-led campus navigation project
                built for the Visayas State University community. It is not an official
                Visayas State University platform, website, or service.
              </p>
              <p>
                Our goal is to make finding classrooms, offices, and amenities as simple as
                possible for students, faculty, and visitors.
              </p>
              <h3 className="text-foreground font-semibold">Key Features</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Interactive Campus Map with detailed building layouts</li>
                <li>Searchable Directory of facilities and rooms</li>
                <li>AI Assistant for natural language location queries</li>
                <li>Real-time updates and community-driven suggestions</li>
              </ul>
              <p>
                This project allows the community to contribute by suggesting edits or adding new locations,
                ensuring the map stays accurate and up-to-date.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ CONTENT */}
        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>Common questions about using the map.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">

                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">How do I find a specific room?</h3>
                  <p className="text-sm text-muted-foreground">
                    Use the search bar at the top of the map or directory page. You can search by room code (e.g., &quot;S101&quot;)
                    or by the building name.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Can I use the map offline?</h3>
                  <p className="text-sm text-muted-foreground">
                    Yes! Campus SmartMap for VSU is a Progressive Web App (PWA). Once you visit the site, map tiles and
                    facility data for recent areas are cached for offline use.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">How do I report an error?</h3>
                  <p className="text-sm text-muted-foreground">
                    If you see incorrect information, open the facility details and choose Suggest Edit.
                    For technical bugs, select the Report a Bug option in the settings menu.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Is this official?</h3>
                  <p className="text-sm text-muted-foreground">
                    No. This is an unofficial student-led initiative to improve campus
                    navigation. It is not operated by, endorsed by, or officially affiliated
                    with Visayas State University. Please verify critical information with
                    university officials.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TERMS CONTENT */}
        <TabsContent value="terms">
          <Card>
            <CardHeader>
              <CardTitle>Terms and Conditions</CardTitle>
              <CardDescription>Last updated: December 2025</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground h-[400px]">
              <ScrollArea className="h-full pr-4">
                <p className="mb-4">
                  Welcome to Campus SmartMap for VSU, an unofficial student-led campus map.
                  By accessing or using our website, you agree to be bound by these terms.
                </p>
                <h3 className="text-foreground font-semibold mb-2">1. Acceptable Use</h3>
                <p className="mb-4">
                  You agree to use this map for lawful purposes only. You must not use this service to harass others,
                  submit false information, or attempt to disrupt the service.
                </p>
                <h3 className="text-foreground font-semibold mb-2">2. User Contributions</h3>
                <p className="mb-4">
                  By submitting content (suggestions, photos), you grant us a non-exclusive license to use, modify,
                  and display that content. You warrant that your contributions are accurate and do not violate third-party rights.
                </p>
                <h3 className="text-foreground font-semibold mb-2">3. Disclaimer</h3>
                <p className="mb-4">
                  The map data is provided &quot;as is&quot;. We do not guarantee the absolute accuracy of locations or facility details.
                  Campus SmartMap for VSU is not an official Visayas State University service.
                  Always exercise personal judgment when navigating.
                </p>
                <h3 className="text-foreground font-semibold mb-2">4. Changes to Terms</h3>
                <p className="mb-4">
                  We reserve the right to modify these terms at any time. Continued use of the platform constitutes
                  acceptance of updated terms.
                </p>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRIVACY CONTENT */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Policy</CardTitle>
              <CardDescription>How we handle your data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                We respect your privacy. This policy explains what data we collect and how we use it.
              </p>
              <h3 className="text-foreground font-semibold">Data Collection</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>**Location Data**: We use your location <strong>only locally</strong> on your device to show where you are on the map. We do not store or track your movements.</li>
                <li>**Chat History**: Chat conversations are stored locally on your device and sent to our AI provider (Google Gemini) for processing. We may store anonymized logs for quality improvement.</li>
                <li>**Cookies**: We use essential cookies for authentication (if you are an admin) and preferences (like theme).</li>
              </ul>
              <h3 className="text-foreground font-semibold">Third-Party Services</h3>
              <p>
                We use Supabase for our database and authentication, and Google AI for the chat assistant.
                Please refer to their respective privacy policies for more details.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACT CONTENT */}
        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
              <CardDescription>Get in touch with the developer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/50">
                  <Github className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold">GitHub Issues</h3>
                    <p className="text-sm text-muted-foreground mb-2">View the source or report a technical issue.</p>
                    <a href="https://github.com/M1Vj/VSU-SmartMap/issues" target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline text-primary break-all">
                      github.com/M1Vj/VSU-SmartMap/issues
                    </a>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <h3 className="font-semibold">Credits</h3>
                <p className="text-sm text-muted-foreground">
                  Created by <strong>Vj F. Mabansag</strong>.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        </Tabs>
      </div>
    </main>
  );
}
