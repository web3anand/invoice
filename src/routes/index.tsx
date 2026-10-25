import { createFileRoute } from "@tanstack/react-router";
import { Desk } from "@/features/bills/components/desk";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Desk />;
}
