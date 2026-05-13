import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

export const metadata = {
  title: `Privacy Policy - ${APP_NAME}`,
  description: `How ${APP_NAME} handles your data and protects your privacy.`,
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
          <div className="ml-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-semibold">{APP_NAME}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: April 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              {APP_NAME} is designed with privacy in mind. We minimize data collection 
              and give you control over your information. This policy explains what data 
              we collect, how we use it, and your rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Video Recordings</h2>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Your video recordings never leave your device.
              </p>
            </div>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Videos are stored locally in your browser using IndexedDB</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Videos are sent to the Interhuman AI API for analysis and not saved by this app</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>This app does not store, retain, or have access to your video files from a server</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>You can delete your locally stored videos at any time from the Saved Videos tab</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Analysis Results</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When you analyze a pitch, we process your video through the Interhuman AI API 
              to generate behavioral insights. The following data may be stored:
            </p>
            <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-1">Stored Locally (Your Browser)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Video recordings and thumbnails</li>
                  <li>• Analysis scores and feedback</li>
                  <li>• Badges earned</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">Stored on Our Servers (If Configured)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Pitch scores and metrics (no video)</li>
                  <li>• Leaderboard entries (display name and score)</li>
                  <li>• Account information (if you create an account)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the following third-party services:
            </p>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary font-bold">•</span>
                <div>
                  <strong className="text-foreground">Interhuman AI</strong> — Processes your video 
                  to analyze behavioral signals. 
                  See{" "}
                  <a 
                    href="https://interhuman.ai/privacy" 
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Interhuman&apos;s Privacy Policy
                  </a>.
                </div>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">•</span>
                <div>
                  <strong className="text-foreground">Supabase</strong> — Stores account data and 
                  leaderboard scores. See{" "}
                  <a 
                    href="https://supabase.com/privacy" 
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Supabase&apos;s Privacy Policy
                  </a>.
                </div>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Cookies & Local Storage</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use browser local storage and IndexedDB to store your videos and preferences 
              locally. We may use cookies for authentication if you create an account. We do 
              not use tracking cookies or third-party analytics.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Delete local data:</strong> Clear your browser data or use the delete button in Saved Videos</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Delete account data:</strong> Contact us to request deletion of any server-stored data</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Export data:</strong> Your local videos can be downloaded directly from your browser</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Video analysis is transmitted over HTTPS. Server-stored data is protected by 
              Supabase&apos;s security infrastructure including encryption at rest and in transit. 
              Local data is stored in your browser&apos;s sandboxed storage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy questions or data deletion requests, contact us at{" "}
              <a href="mailto:youremail@yourdomain.com" className="text-primary hover:underline">
                youremail@yourdomain.com
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
