"use client";

import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { ProfileContent } from "../../components/profile/ProfileContent";

export default function ProfilePage() {
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect(`/`);
    }
  }, [status]);

  return <ProfileContent showTitle={true} />;
}
