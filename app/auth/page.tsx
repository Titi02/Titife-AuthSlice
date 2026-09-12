import { AuthFlow } from "@/components/auth/auth-flow";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  const { screen } = await searchParams;
  const initialScreen = screen === "signin" ? "signin" : "signup";
  return <AuthFlow initialScreen={initialScreen} />;
}
