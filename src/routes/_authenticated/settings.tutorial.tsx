import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings-page";
import { TutorialTour } from "@/components/tutorial/tutorial-tour";

export const Route = createFileRoute("/_authenticated/settings/tutorial")({
  head: () => ({
    meta: [
      { title: "Tutorial — CoursePro" },
      {
        name: "description",
        content: "A one-minute tour of CoursePro: To-Do, Calendar, Study, Grades and reminders.",
      },
      { property: "og:title", content: "Tutorial — CoursePro" },
      { property: "og:description", content: "A one-minute tour of CoursePro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TutorialPage,
});

function TutorialPage() {
  return (
    <SettingsPage
      title="Tutorial"
      description="A one-minute tour of CoursePro. Use the arrows, or swipe the picture."
    >
      <TutorialTour />
    </SettingsPage>
  );
}
