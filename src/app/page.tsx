import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { userId } = await auth();

  console.log("CLERK USER ID:", userId);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-xl font-semibold">
        Logged in as: {userId ?? "Not logged in"}
      </h1>
    </div>
  );
}